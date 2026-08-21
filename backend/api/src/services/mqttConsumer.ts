import mqtt from 'mqtt';
import { Pool } from 'pg';
import { getPgPoolOrThrow } from '../db/pg';
import {
  detectFlatline,
  detectImplausibleJump,
  confirmedBreach,
  buildTriggerSummary,
  buildRootCauseSignature,
  recommendedAction,
  passesRoiFilter,
  estimateCostAvoided,
  upsertAlert,
  tickDwellAndAutoClose,
  type ThresholdBreach,
} from './alertEngine';
import { sendWebhookDelivery } from './webhookDelivery';

// ASSUMPTION — not yet verified against your simulator's actual publish code:
// topic pattern "sensors/{sensorId}/reading", JSON payload { value: number, timestamp: string }.
// If your simulator publishes differently, only this file's parsing needs to change —
// nothing else in alertEngine.ts depends on MQTT's shape.
const TOPIC_PATTERN = 'sensors/+/reading';

// In-memory ring buffer per sensor for flatline detection ONLY — separate
// from persistence below. Kept small and in-memory since it's just for the
// "are the last 10 readings identical" check, which doesn't need to survive
// a restart.
//
// KNOWN LIMIT: keyed only by sensorId, no tenant/session separation. Fine
// for live MQTT (one process, one stream in real time). During a CSV
// backfill import, rows MUST be pre-sorted per sensor in chronological
// order by the caller (see import.ts) — this buffer has no idea it's
// replaying history vs. receiving live data, and will silently produce
// wrong flatline/breach-confirmation results if fed out of order.
const recentValues = new Map<string, number[]>();
const RING_BUFFER_SIZE = 12;

const lastKnownReadings = new Map<string, { value: number; timestamp: string }>();

export function getLastKnownReading(sensorId: string): { value: number; timestamp: string } | null {
  return lastKnownReadings.get(sensorId) ?? null;
}

function recordLastKnown(sensorId: string, value: number): void {
  lastKnownReadings.set(sensorId, { value, timestamp: new Date().toISOString() });
}

// Durable persistence into the REAL sensor_readings table (columns:
// sensor_id, value, reading_at, is_flagged_bad, flag_reason — this table
// already existed with this schema; earlier code here guessed a different
// shape and was wrong, this matches what's actually there).
//
// Flags are recorded, not just detected-and-discarded — a flatlined or
// implausible-jump reading still gets written (for audit purposes) but
// marked bad, so predictiveTrend.ts can correctly exclude it from any
// trend calculation instead of letting a glitch corrupt a projection.
//
// CHANGED: now takes `pool` explicitly (was getPgPoolOrThrow() internally —
// not org-aware, blocked reuse from the per-org CSV import path) and an
// optional `readingAt` so backfilled historical readings keep their real
// vendor timestamp instead of being stamped with import wall-clock time.
async function recordReading(
  pool: Pool,
  sensorId: string,
  value: number,
  isFlaggedBad: boolean,
  flagReason: string | null,
  readingAt?: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO sensor_readings (sensor_id, value, is_flagged_bad, flag_reason, reading_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, now()))`,
      [sensorId, value, isFlaggedBad, flagReason, readingAt ?? null],
    );
  } catch (err) {
    console.error(`[mqttConsumer] failed to persist reading for ${sensorId}:`, err);
  }
}

function pushRecent(sensorId: string, value: number): number[] {
  const arr = recentValues.get(sensorId) ?? [];
  arr.push(value);
  if (arr.length > RING_BUFFER_SIZE) arr.shift();
  recentValues.set(sensorId, arr);
  return arr;
}

interface SensorConfig {
  id: string;
  asset_id: string;
  sensor_type: string;
  unit: string;
  baseline_value: number | null;
  hard_min: number | null;
  hard_max: number | null;
  manual_override_min: number | null;
  manual_override_max: number | null;
}

interface AssetConfig {
  id: string;
  replacement_cost: number | null;
  downtime_cost_per_hour: number | null;
  is_low_priority: boolean;
  platform: string;
}

export function startMqttConsumer(mqttUrl: string): void {
  const client = mqtt.connect(mqttUrl);

  client.on('connect', () => {
    console.log(`[mqttConsumer] connected to ${mqttUrl}, subscribing to ${TOPIC_PATTERN}`);
    client.subscribe(TOPIC_PATTERN);
  });

  client.on('error', (err) => {
    console.error('[mqttConsumer] connection error:', err.message);
  });

  client.on('message', async (topic, payload) => {
    try {
      const sensorId = topic.split('/')[1];
      const parsed = JSON.parse(payload.toString()) as { value: number; timestamp?: string };
      // KNOWN GAP (separate ticket, not fixed here): getPgPoolOrThrow() is the
      // global/default pool, not tenant-scoped. MQTT topic/payload carries no
      // org info today, so there's nothing to resolve a per-org pool from yet.
      // Every other route was retrofitted to req.orgPool under Item 9c-2; this
      // live-ingest path was missed and still needs its own design (topic
      // namespacing or a device->org lookup) before it's truly multi-tenant.
      await evaluateReading(getPgPoolOrThrow(), sensorId, parsed.value);
    } catch (err) {
      console.error(`[mqttConsumer] failed to process message on ${topic}:`, err);
    }
  });
}

/** Core evaluation: sensor-health check -> threshold check -> ROI filter -> alert.
 *  Exported separately from the MQTT wiring so it can be unit-tested or
 *  called from a CSV batch-import path (e.g. real vendor data) without MQTT.
 *
 *  `pool` is now required (not fetched internally) so a caller can pass a
 *  tenant-scoped pool (req.orgPool from an import route) instead of the
 *  global default.
 *
 *  `opts` exists ONLY for backfill/CSV import — the live MQTT call site
 *  above passes none, preserving today's live behavior exactly:
 *    - readingTimestamp: stamps sensor_readings.reading_at AND, if this
 *      reading produces a new alert, alerts.created_at/updated_at — without
 *      this, backfilled alerts are timestamped at import time, which makes
 *      "did the alert fire before the real failure" unanswerable.
 *    - suppressDelivery: skips sendWebhookDelivery — without this, backfilling
 *      a year of historical readings would fire real SMS/email/CMMS
 *      notifications for events that already happened.
 *    - skipDwellTick: skips the wall-clock dwell/auto-close check — that
 *      logic measures now() - dwell_start_at and is meaningless against
 *      historical data replayed all at once.
 */
export async function evaluateReading(
  pool: Pool,
  sensorId: string,
  value: number,
  opts?: { readingTimestamp?: string; suppressDelivery?: boolean; skipDwellTick?: boolean },
): Promise<void> {
  recordLastKnown(sensorId, value);

  const sensorRes = await pool.query<SensorConfig>(
    `SELECT id, asset_id, sensor_type, unit, baseline_value, hard_min, hard_max,
            manual_override_min, manual_override_max
     FROM sensors WHERE id = $1`,
    [sensorId],
  );
  const sensor = sensorRes.rows[0];
  if (!sensor) {
    console.warn(`[evaluateReading] unknown sensor: ${sensorId}`);
    return;
  }

  // Problem 6: sensor-health check runs BEFORE any threshold logic sees the
  // value, and now BEFORE persistence too — so the flag is known at write
  // time instead of being lost.
  const history = pushRecent(sensorId, value);

  if (detectFlatline(history)) {
    console.warn(`[evaluateReading] ${sensorId} flagged FLATLINE — suppressing from alert pipeline`);
    await recordReading(pool, sensorId, value, true, 'flatline', opts?.readingTimestamp);
    return;
  }
  if (history.length >= 2 && detectImplausibleJump(history[history.length - 2], value)) {
    console.warn(`[evaluateReading] ${sensorId} flagged IMPLAUSIBLE JUMP — suppressing from alert pipeline`);
    await recordReading(pool, sensorId, value, true, 'implausible_jump', opts?.readingTimestamp);
    return;
  }

  // Clean reading — persist without a flag.
  await recordReading(pool, sensorId, value, false, null, opts?.readingTimestamp);

  // Problem 3: rule-based thresholds run Day 1 — manual override takes
  // precedence over the hard default when a manager has set one.
  const min = sensor.manual_override_min ?? sensor.hard_min;
  const max = sensor.manual_override_max ?? sensor.hard_max;

  const breaches: ThresholdBreach[] = [];
  if (min !== null && value < min) {
    breaches.push({
      sensorId: sensor.id,
      sensorType: sensor.sensor_type,
      unit: sensor.unit,
      currentValue: value,
      baselineValue: sensor.baseline_value,
      breachedBound: sensor.manual_override_min !== null ? 'manual_min' : 'hard_min',
      boundValue: min,
    });
  }
  if (max !== null && value > max) {
    breaches.push({
      sensorId: sensor.id,
      sensorType: sensor.sensor_type,
      unit: sensor.unit,
      currentValue: value,
      baselineValue: sensor.baseline_value,
      breachedBound: sensor.manual_override_max !== null ? 'manual_max' : 'hard_max',
      boundValue: max,
    });
  }

  // No breach: if there's an open alert for this asset, tick its dwell timer
  // toward auto-close (Problem 2) instead of doing nothing.
  if (breaches.length === 0) {
    confirmedBreach(sensorId, null); // clear pending state — reading is back in range
    if (!opts?.skipDwellTick) {
      const openAlert = await pool.query<{ id: string }>(
        `SELECT id FROM alerts WHERE asset_id = $1 AND status IN ('open','acknowledged','escalated') LIMIT 1`,
        [sensor.asset_id],
      );
      if (openAlert.rows[0]) {
        await tickDwellAndAutoClose(pool, openAlert.rows[0].id, true);
      }
    }
    return;
  }

  // Require the same breach direction on 2 consecutive readings before
  // proceeding — guards against a single glitchy or stuck-and-out-of-range
  // reading firing an alert before flatline detection has enough history.
  if (!confirmedBreach(sensorId, breaches[0].breachedBound)) {
    console.log(`[evaluateReading] ${sensorId} breach seen once — waiting for confirmation on next reading`);
    return;
  }

  // Problem 4: ROI filter — never alert on an asset without qualifying cost data.
  const assetRes = await pool.query<AssetConfig>(
    `SELECT id, replacement_cost, downtime_cost_per_hour, is_low_priority, platform FROM assets WHERE id = $1`,
    [sensor.asset_id],
  );
  const asset = assetRes.rows[0];
  if (!asset) {
    console.warn(`[evaluateReading] sensor ${sensorId} references unknown asset ${sensor.asset_id}`);
    return;
  }

  const cost = {
    replacementCost: asset.replacement_cost,
    downtimeCostPerHour: asset.downtime_cost_per_hour,
    isLowPriority: asset.is_low_priority,
  };
  if (!passesRoiFilter(cost)) {
    // Correct, expected behavior until real cost data exists — not a bug.
    return;
  }

  const triggerSummary = buildTriggerSummary(breaches);
  const signature = buildRootCauseSignature(sensor.asset_id, breaches);
  const tier: 'red' | 'yellow' | 'green' = breaches.some((b) => b.breachedBound.includes('max'))
    ? 'red'
    : 'yellow';

  const { id, isNew } = await upsertAlert(pool, {
    assetId: sensor.asset_id,
    predictionId: null, // rule-based — no ML prediction backing this alert
    rootCauseSignature: signature,
    source: 'rule',
    tier,
    triggerSummary,
    recommendedActionText: recommendedAction(breaches),
    confidence: null, // Problem 1: never fabricate a confidence on a rule-based alert
    costAvoidedEstimate: estimateCostAvoided(cost),
    occurredAt: opts?.readingTimestamp ?? null,
  });

  if (isNew) {
    console.log(`[evaluateReading] NEW alert ${id} for ${sensor.asset_id}: ${triggerSummary}`);
    if (!opts?.suppressDelivery) {
      await sendWebhookDelivery(pool, id);
    }
  }
}
