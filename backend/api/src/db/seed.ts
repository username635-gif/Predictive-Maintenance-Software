/**
 * Seeds `assets` and `sensors` from the same segment/sensor generation logic
 * mockDatabase.ts uses, so the geometry (mile markers, lat/lng) matches what
 * the frontend map already expects.
 *
 * IMPORTANT — read before running:
 * replacement_cost and downtime_cost_per_hour are seeded as NULL. The mock
 * data has no cost figures anywhere, and inventing plausible-looking dollar
 * values would be the same mistake as the fabricated confidence scores
 * flagged earlier — numbers that look authoritative but aren't grounded in
 * anything real. Problem 4's ROI filter (see alertEngine.ts passesRoiFilter)
 * correctly treats NULL cost as "don't alert" — so until real costs are
 * entered per asset, no alerts will fire for cost reasons. That's the
 * correct behavior, not a bug: it's better to alert on nothing than to
 * alert based on a fabricated dollar figure.
 *
 * priority is also seeded as 'unset', not derived from health_score.
 * Health and business priority are different axes — a critical-health
 * sensor on a cheap, easily-replaced asset still shouldn't out-prioritize
 * a healthy sensor on a $2M asset. Priority must be set from real
 * replacement/downtime cost once entered, not from current health.
 *
 * Run with: npx ts-node src/db/seed.ts   (from backend/api)
 */

import { getPgPool } from './pg';

// ── Same geometry as mockDatabase.ts, so seeded assets line up with the map ──
const ANCHORS: [number, number][] = [
  [31.57, -103.48], [31.68, -103.21], [31.82, -102.89], [31.95, -102.51],
  [32.05, -102.14], [32.12, -101.78], [32.22, -101.35], [32.34, -101.02],
  [32.42, -100.68], [32.51, -100.34], [32.58, -99.95],
];

function interpolateMile(mile: number): [number, number] {
  const maxMile = 500;
  const t = (mile / maxMile) * (ANCHORS.length - 1);
  const i = Math.min(Math.floor(t), ANCHORS.length - 2);
  const f = t - i;
  return [
    ANCHORS[i][0] + f * (ANCHORS[i + 1][0] - ANCHORS[i][0]),
    ANCHORS[i][1] + f * (ANCHORS[i + 1][1] - ANCHORS[i][1]),
  ];
}

const HEALTH_OVERRIDES: Record<number, number> = {
  14: 52, 20: 18, 21: 44, 35: 31, 36: 29, 42: 63,
};

function healthStatus(score: number): 'good' | 'warning' | 'critical' {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

const SENSOR_TYPES = [
  { type: 'ultrasonic_thickness', unit: 'mm', range: [8.0, 10.5] as [number, number] },
  { type: 'pressure_transmitter', unit: 'psi', range: [700, 980] as [number, number] },
  { type: 'acoustic_emission', unit: 'dB', range: [20, 65] as [number, number] },
  { type: 'cathodic_protection', unit: 'mV', range: [-950, -800] as [number, number] },
];

async function seed() {
  const pool = await getPgPool();

  let assetsInserted = 0;
  let sensorsInserted = 0;

  for (let i = 0; i < 50; i++) {
    const mileStart = i * 10;
    const mileEnd = mileStart + 10;
    const id = `SEG-${String(i + 1).padStart(3, '0')}`;
    const healthScore = HEALTH_OVERRIDES[i] ?? Math.min(100, 72 + Math.round(Math.sin(i * 0.7) * 12 + Math.cos(i * 1.3) * 8));
    const midMile = (mileStart + mileEnd) / 2;
    const [lat, lng] = interpolateMile(midMile);

    await pool.query(
      `INSERT INTO assets (id, name, platform, line, zone, latitude, longitude, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'unset')
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        `${id} Mile ${mileStart}-${mileEnd}`,
        'West Texas Pipeline', // platform-level grouping; adjust to your real site naming
        `Mile ${mileStart}-${mileEnd}`,
        healthStatus(healthScore), // stored as a rough zone label only — NOT used as priority, see note above
        lat,
        lng,
      ],
    );
    assetsInserted++;

    for (const spec of SENSOR_TYPES) {
      const sensorId = `SEN-${id}-${spec.type}`;
      await pool.query(
        `INSERT INTO sensors (id, asset_id, sensor_type, unit, hard_min, hard_max)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [sensorId, id, spec.type, spec.unit, spec.range[0], spec.range[1]],
      );
      sensorsInserted++;
    }
  }

  console.log(`Seeded ${assetsInserted} assets, ${sensorsInserted} sensors.`);
  console.log(`⚠ Cost fields are NULL on every asset — Problem 4's ROI filter will alert on nothing until real replacement_cost / downtime_cost_per_hour are entered per asset.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});