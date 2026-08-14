/**
 * Proves the alert pipeline works end-to-end without MQTT.
 * Sets real cost data on one test asset (unblocking Problem 4's ROI filter),
 * then feeds a threshold-breaching reading straight into evaluateReading()
 * and checks whether a real alert landed in Postgres.
 *
 * Run with: npx ts-node src\testAlertPipeline.ts
 */

import { getPgPool } from './db/pg';
import { evaluateReading } from './services/mqttConsumer';
import { recordIgnoredAndMaybeEscalate, tickDwellAndAutoClose } from './services/alertEngine';

async function main() {
  const pool = await getPgPool();

  // Give ONE real asset real cost data so it passes Problem 4's ROI filter.
  // SEG-021 is your seeded "critical" health-override asset from mockDatabase's
  // original design — a reasonable pick for a first test.
  await pool.query(
    `UPDATE assets SET replacement_cost = 250000, downtime_cost_per_hour = 15000
     WHERE id = 'SEG-021'`,
  );
  console.log('✅ Set test cost data on SEG-021');

  // Find one of its pressure sensors to breach.
  const sensorRes = await pool.query<{ id: string; hard_min: number; hard_max: number }>(
    `SELECT id, hard_min, hard_max FROM sensors
     WHERE asset_id = 'SEG-021' AND sensor_type = 'pressure_transmitter' LIMIT 1`,
  );
  const sensor = sensorRes.rows[0];
  if (!sensor) {
    console.error('❌ No pressure sensor found on SEG-021 — did the seed script run?');
    process.exit(1);
  }
  console.log(`Found sensor ${sensor.id}, hard_min=${sensor.hard_min}, hard_max=${sensor.hard_max}`);

  // Feed enough normal readings first so flatline detection doesn't false-positive
  // on the ring buffer being empty, then breach below hard_min.
  const midpoint = (sensor.hard_min + sensor.hard_max) / 2;
  for (let i = 0; i < 3; i++) {
    await evaluateReading(sensor.id, midpoint + (Math.random() - 0.5));
  }

  const breachValue = sensor.hard_min - 25; // clearly below threshold
  console.log(`Feeding breach reading: ${breachValue} (below hard_min of ${sensor.hard_min})`);
  await evaluateReading(sensor.id, breachValue); // 1st breach — expected to be held pending, no alert yet
  await evaluateReading(sensor.id, breachValue); // 2nd consecutive same-direction breach — should confirm and alert

  // Check what actually landed in the alerts table.
  const alertRes = await pool.query(
    `SELECT id, asset_id, tier, trigger_summary, recommended_action, cost_avoided_estimate, status
     FROM alerts WHERE asset_id = 'SEG-021' ORDER BY created_at DESC LIMIT 1`,
  );

  if (alertRes.rows.length === 0) {
    console.error('❌ No alert was created. Something in the pipeline is blocking it — check passesRoiFilter or the threshold comparison.');
    process.exit(1);
  }
  const alertId = alertRes.rows[0].id;
  console.log('✅ ALERT CREATED:');
  console.log(JSON.stringify(alertRes.rows[0], null, 2));

  // ── Test 2: escalation after 3 ignores ──────────────────────────────
  console.log('\n--- Testing escalation (ignore 3x) ---');
  let escalated = false;
  for (let i = 1; i <= 3; i++) {
    const result = await recordIgnoredAndMaybeEscalate(pool, alertId, 'shift-supervisor');
    console.log(`Ignore ${i}: escalated=${result.escalated}`);
    escalated = result.escalated;
  }
  if (!escalated) {
    console.error('❌ Alert was NOT escalated after 3 ignores — expected escalation on the 3rd.');
  } else {
    const check = await pool.query(`SELECT status, escalated_to, ignored_count FROM alerts WHERE id = $1`, [alertId]);
    console.log('✅ ESCALATED:', JSON.stringify(check.rows[0]));
  }

  // ── Test 3: auto-close after sustained dwell in baseline ────────────
  console.log('\n--- Testing auto-close dwell (simulated — see note) ---');
  // Real dwell requires AUTO_CLOSE_DWELL_MINUTES (120 min) of real time, which
  // isn't practical to wait for in a manual test. This confirms the dwell
  // timer STARTS correctly when a reading returns to baseline; the actual
  // 120-minute close threshold is verified by code review of
  // tickDwellAndAutoClose, not a real-time wait here.
  await tickDwellAndAutoClose(pool, alertId, true);
  const dwellCheck = await pool.query(`SELECT dwell_start_at, status FROM alerts WHERE id = $1`, [alertId]);
  if (dwellCheck.rows[0]?.dwell_start_at) {
    console.log('✅ Dwell timer started:', dwellCheck.rows[0]);
  } else {
    console.error('❌ Dwell timer did not start when it should have.');
  }

  // ── Test 4: flatline detection (Problem 6) — honest scope note ──────
  // confirmedBreach now requires 2 consecutive same-direction breaches
  // before alerting (added specifically to narrow this gap), so a sensor
  // stuck at an out-of-range value fires on reading #2, not #1. Flatline
  // detection (10 identical readings) still can't prevent that — it only
  // suppresses further noise AFTER the fact. This is a known, accepted
  // limitation, not something this test claims to fully solve.
  console.log('\n--- Testing flatline detection scope (Problem 6) ---');
  await pool.query(`DELETE FROM alerts WHERE asset_id = 'SEG-021'`);
  const stuckNormalValue = 850; // in-range, so flatline alone is testable without threshold interference
  for (let i = 0; i < 12; i++) {
    await evaluateReading(sensorRes.rows[0].id, stuckNormalValue);
  }
  const noAlertExpected = await pool.query(`SELECT id FROM alerts WHERE asset_id = 'SEG-021'`);
  console.log(
    noAlertExpected.rows.length === 0
      ? '✅ In-range stuck sensor: no alert (correct — value was in range regardless of flatline).'
      : '❌ Unexpected alert from an in-range stuck sensor.',
  );
  console.log('ℹ Known gap: an OUT-OF-range stuck sensor still fires on its 2nd identical reading (via confirmedBreach), before flatline\'s 10-reading window would catch it. Not fully solved — flagged, not hidden.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});