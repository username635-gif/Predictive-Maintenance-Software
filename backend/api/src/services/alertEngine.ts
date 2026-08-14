import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────────────────
// Problem 1: Trigger Summary — never fabricate a confidence number.
// Rule-based alerts carry evidence text. ML alerts only get a numeric
// confidence once model_feedback has enough validated samples (see
// getMlConfidenceIfValidated below) — this is Problem 3's real fix,
// replacing the original spec's fictional "Week 4: 90% confidence".
// ─────────────────────────────────────────────────────────────────────────

export interface ThresholdBreach {
  sensorId: string;
  sensorType: string;
  unit: string;
  currentValue: number;
  baselineValue: number | null;
  breachedBound: 'hard_min' | 'hard_max' | 'manual_min' | 'manual_max';
  boundValue: number;
}

export function buildTriggerSummary(breaches: ThresholdBreach[]): string {
  // Problem 1: concatenate the actual sensor readings that caused the alert.
  return breaches
    .map((b) => {
      const baselineText = b.baselineValue !== null
        ? ` (baseline: ${b.baselineValue}${b.unit})`
        : '';
      return `${b.sensorType}: ${b.currentValue}${b.unit}${baselineText}`;
    })
    .join(' + ');
}

export function buildRootCauseSignature(assetId: string, breaches: ThresholdBreach[]): string {
  // Problem 2: dedupe key. Same asset + same set of breached sensors +
  // same bound direction = the same underlying issue, not a new alert.
  const sensorKey = breaches
    .map((b) => `${b.sensorId}:${b.breachedBound}`)
    .sort()
    .join(',');
  return `${assetId}::${sensorKey}`;
}

// Plain-English action text — the "Dave" problem. Kept as a lookup, not
// generated prose, so it stays predictable and reviewable by a human
// before it ships (a maintenance manager should be able to audit this list).
// Keys MUST match the sensor_type values actually seeded in the sensors
// table (see seed.ts's SENSOR_TYPES) — a mismatch here silently falls back
// to the generic default with no error, which is exactly what happened on
// the first live test (pressure_transmitter_low had no entry).
const ACTION_LIBRARY: Record<string, string> = {
  pressure_transmitter_low: 'Inspect for leak at the flagged asset. If seal is visibly leaking, tighten per spec torque. Replace if cracked.',
  pressure_transmitter_high: 'Check for downstream blockage. Verify relief valve is functioning before reducing flow.',
  ultrasonic_thickness_low: 'Wall thickness below spec — schedule inspection for corrosion or erosion. Do not delay past next scheduled pig run.',
  acoustic_emission_high: 'Elevated acoustic activity — inspect for active crack growth or leak signature before continuing normal operation.',
  // CP potential is negative mV: a breach below hard_min (more negative) means
  // OVER-protected; a breach above hard_max (less negative, closer to 0) means
  // UNDER-protected — the opposite of most sensors where "low" is the concerning direction.
  cathodic_protection_low: 'CP potential over-protected (unusually negative) — check for stray current or rectifier overcorrection.',
  cathodic_protection_high: 'CP potential under-protected — check rectifier output and anode condition. Corrosion risk increasing.',
  default: 'Inspect the flagged asset in person. Confirm sensor reading against manual gauge before acting.',
};

export function recommendedAction(breaches: ThresholdBreach[]): string {
  const primary = breaches[0];
  if (!primary) return ACTION_LIBRARY.default;
  const key = `${primary.sensorType}_${primary.breachedBound.includes('max') ? 'high' : 'low'}`;
  return ACTION_LIBRARY[key] ?? ACTION_LIBRARY.default;
}

// ─────────────────────────────────────────────────────────────────────────
// Problem 3: ML confidence gated on validated precision (model_feedback),
// never on a calendar. Returns null until there's enough validated history
// to trust a number — a null confidence on an ML alert is correct and
// honest, not a bug.
// ─────────────────────────────────────────────────────────────────────────

const MIN_VALIDATED_SAMPLES = 30; // don't trust a % below this — tune per your failure base rate

export async function getMlConfidenceIfValidated(
  pool: Pool,
  assetClass: string,
  rawModelScore: number,
): Promise<number | null> {
  const { rows } = await pool.query<{ total: string; correct: string }>(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE was_correct) AS correct
     FROM model_feedback mf
     JOIN predictions p ON p.id = mf.prediction_id
     JOIN assets a ON a.id = p.segment_id
     WHERE a.platform = $1`,
    [assetClass],
  );
  const total = Number(rows[0]?.total ?? 0);
  const correct = Number(rows[0]?.correct ?? 0);

  if (total < MIN_VALIDATED_SAMPLES) return null; // not enough validated history — show evidence, not a %

  const historicalPrecision = correct / total;
  // Blend the model's raw score with observed real-world precision rather
  // than trusting the model's self-reported confidence outright.
  return Math.round(((rawModelScore + historicalPrecision) / 2) * 10000) / 10000;
}

// ─────────────────────────────────────────────────────────────────────────
// Problem 4: cost-based filtering. An asset with no cost data or flagged
// low-priority never generates an alert — this is the ROI gate.
// ─────────────────────────────────────────────────────────────────────────

export interface AssetCost {
  replacementCost: number | null;
  downtimeCostPerHour: number | null;
  isLowPriority: boolean;
}

const REPLACEMENT_COST_THRESHOLD = 10_000;
const DOWNTIME_COST_THRESHOLD_PER_HOUR = 5_000;

export function passesRoiFilter(cost: AssetCost): boolean {
  if (cost.isLowPriority) return false; // manual ignore-list, always respected
  const highReplacement = (cost.replacementCost ?? 0) > REPLACEMENT_COST_THRESHOLD;
  const highDowntime = (cost.downtimeCostPerHour ?? 0) > DOWNTIME_COST_THRESHOLD_PER_HOUR;
  return highReplacement || highDowntime;
}

export function estimateCostAvoided(cost: AssetCost, estimatedDowntimeHours = 24): number {
  // pg returns NUMERIC columns as strings (to avoid float precision loss on
  // large values), not JS numbers. Number(...) here is not optional — without
  // it, JS's '+' silently concatenates strings instead of adding, which is
  // exactly what produced "360000250000.00" on the first live test run.
  const downtimeCostPerHour = Number(cost.downtimeCostPerHour ?? 0);
  const replacementCost = Number(cost.replacementCost ?? 0);
  const downtimeCost = downtimeCostPerHour * estimatedDowntimeHours;
  return downtimeCost + replacementCost;
}

// ─────────────────────────────────────────────────────────────────────────
// Problem 2: dedupe + escalate. Never cap total alerts by count — cap by
// signature. An open alert with the same root_cause_signature gets its
// existing row touched, not a duplicate row.
// ─────────────────────────────────────────────────────────────────────────

const IGNORED_ESCALATION_THRESHOLD = 3;
const AUTO_CLOSE_DWELL_MINUTES = 120; // metric must hold inside baseline this long before auto-close

export async function upsertAlert(
  pool: Pool,
  params: {
    assetId: string;
    predictionId: string | null;
    rootCauseSignature: string;
    source: 'rule' | 'ml';
    tier: 'red' | 'yellow' | 'green';
    triggerSummary: string;
    recommendedActionText: string;
    confidence: number | null;
    costAvoidedEstimate: number;
  },
): Promise<{ id: string; isNew: boolean }> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM alerts WHERE root_cause_signature = $1 AND status IN ('open','acknowledged','escalated') LIMIT 1`,
    [params.rootCauseSignature],
  );

  if (existing.rows.length > 0) {
    // Same underlying issue still active — refresh evidence, don't duplicate.
    await pool.query(
      `UPDATE alerts SET trigger_summary = $1, confidence = $2, updated_at = now(), dwell_start_at = NULL
       WHERE id = $3`,
      [params.triggerSummary, params.confidence, existing.rows[0].id],
    );
    return { id: existing.rows[0].id, isNew: false };
  }

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO alerts
       (asset_id, prediction_id, root_cause_signature, source, tier, trigger_summary,
        recommended_action, confidence, cost_avoided_estimate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      params.assetId,
      params.predictionId,
      params.rootCauseSignature,
      params.source,
      params.tier,
      params.triggerSummary,
      params.recommendedActionText,
      params.confidence,
      params.costAvoidedEstimate,
    ],
  );
  return { id: inserted.rows[0].id, isNew: true };
}

/** Call this once per polling cycle for every currently-open alert whose
 *  breach condition no longer holds. Auto-closes only after the metric has
 *  held inside baseline for AUTO_CLOSE_DWELL_MINUTES straight — prevents
 *  flapping open/closed on a noisy sensor. */
export async function tickDwellAndAutoClose(pool: Pool, alertId: string, currentlyInBaseline: boolean): Promise<void> {
  if (!currentlyInBaseline) {
    await pool.query(`UPDATE alerts SET dwell_start_at = NULL WHERE id = $1`, [alertId]);
    return;
  }
  const { rows } = await pool.query<{ dwell_start_at: string | null }>(
    `SELECT dwell_start_at FROM alerts WHERE id = $1`,
    [alertId],
  );
  if (!rows[0]) return;

  if (!rows[0].dwell_start_at) {
    await pool.query(`UPDATE alerts SET dwell_start_at = now() WHERE id = $1`, [alertId]);
    return;
  }

  const dwellMinutes = (Date.now() - new Date(rows[0].dwell_start_at).getTime()) / 60_000;
  if (dwellMinutes >= AUTO_CLOSE_DWELL_MINUTES) {
    await pool.query(
      `UPDATE alerts SET status = 'resolved', resolved_at = now(), updated_at = now() WHERE id = $1`,
      [alertId],
    );
  }
}

/** Never mutes on repeat ignores — escalates to a second contact instead. */
export async function recordIgnoredAndMaybeEscalate(
  pool: Pool,
  alertId: string,
  escalationTarget: string,
): Promise<{ escalated: boolean }> {
  const { rows } = await pool.query<{ ignored_count: number }>(
    `UPDATE alerts SET ignored_count = ignored_count + 1 WHERE id = $1 RETURNING ignored_count`,
    [alertId],
  );
  const count = rows[0]?.ignored_count ?? 0;

  if (count >= IGNORED_ESCALATION_THRESHOLD) {
    await pool.query(
      `UPDATE alerts SET status = 'escalated', escalated_to = $2, updated_at = now() WHERE id = $1`,
      [alertId, escalationTarget],
    );
    return { escalated: true };
  }
  return { escalated: false };
}

// ─────────────────────────────────────────────────────────────────────────
// Problem 6: sensor data quality. Flags a reading as bad before it's ever
// allowed to reach the threshold/alert logic above.
// ─────────────────────────────────────────────────────────────────────────

const FLATLINE_WINDOW_READINGS = 10; // consecutive identical readings = stuck sensor
const MAX_PLAUSIBLE_RATE_OF_CHANGE_PCT = 50; // % change between consecutive readings

export function detectFlatline(recentValues: number[]): boolean {
  if (recentValues.length < FLATLINE_WINDOW_READINGS) return false;
  const window = recentValues.slice(-FLATLINE_WINDOW_READINGS);
  return window.every((v) => v === window[0]);
}

export function detectImplausibleJump(previousValue: number, currentValue: number): boolean {
  if (previousValue === 0) return false;
  const pctChange = Math.abs((currentValue - previousValue) / previousValue) * 100;
  return pctChange > MAX_PLAUSIBLE_RATE_OF_CHANGE_PCT;
}

// A single out-of-range reading is not enough to fire an alert — it could be
// a transient glitch or, worse, a sensor stuck at a bad value (which
// detectFlatline can't catch until 10 readings of history exist). Requiring
// the SAME breach direction on 2 consecutive readings closes that gap
// without waiting for flatline's longer window.
const pendingBreaches = new Map<string, 'hard_min' | 'hard_max' | 'manual_min' | 'manual_max'>();

export function confirmedBreach(
  sensorId: string,
  currentBreach: 'hard_min' | 'hard_max' | 'manual_min' | 'manual_max' | null,
): boolean {
  const previous = pendingBreaches.get(sensorId) ?? null;

  if (currentBreach === null) {
    pendingBreaches.delete(sensorId);
    return false;
  }

  pendingBreaches.set(sensorId, currentBreach);
  return previous === currentBreach; // confirmed only if the SAME breach direction repeated
}