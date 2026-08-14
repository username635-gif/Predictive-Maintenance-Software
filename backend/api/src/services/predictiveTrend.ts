import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────────────────
// This is a LINEAR TREND PROJECTION, not an AI/ML forecast. Same discipline
// as alertEngine.ts's getMlConfidenceIfValidated: never produce a confident
// number without enough real data behind it.
//
// Reads from the REAL sensor_readings table (reading_at, is_flagged_bad,
// flag_reason) — flagged-bad readings (flatline/implausible jump) are
// excluded from the regression, since including a stuck-sensor or glitch
// reading would corrupt the slope calculation.
// ─────────────────────────────────────────────────────────────────────────

export interface TrendProjection {
  sensorId: string;
  basedOnReadings: number;
  slopePerHour: number | null;
  boundApproaching: 'hard_min' | 'hard_max' | 'manual_min' | 'manual_max' | null;
  projectedCrossingAt: string | null;
  message: string;
}

const MIN_READINGS_FOR_TREND = 20;

export async function computeTrendProjection(pool: Pool, sensorId: string): Promise<TrendProjection> {
  const sensorRes = await pool.query<{
    hard_min: number | null;
    hard_max: number | null;
    manual_override_min: number | null;
    manual_override_max: number | null;
  }>(
    `SELECT hard_min, hard_max, manual_override_min, manual_override_max FROM sensors WHERE id = $1`,
    [sensorId],
  );
  const sensor = sensorRes.rows[0];
  if (!sensor) {
    return {
      sensorId,
      basedOnReadings: 0,
      slopePerHour: null,
      boundApproaching: null,
      projectedCrossingAt: null,
      message: 'Unknown sensor.',
    };
  }

  const readingsRes = await pool.query<{ value: string; reading_at: string }>(
    `SELECT value, reading_at FROM sensor_readings
     WHERE sensor_id = $1 AND is_flagged_bad = false
     ORDER BY reading_at ASC`,
    [sensorId],
  );
  const readings = readingsRes.rows;

  if (readings.length < MIN_READINGS_FOR_TREND) {
    return {
      sensorId,
      basedOnReadings: readings.length,
      slopePerHour: null,
      boundApproaching: null,
      projectedCrossingAt: null,
      message: `Not enough clean historical data yet (${readings.length}/${MIN_READINGS_FOR_TREND} valid readings). This is a trend projection, not an AI forecast — it needs real history to stay honest, same as never fabricating a confidence score.`,
    };
  }

  const t0 = new Date(readings[0].reading_at).getTime();
  const points = readings.map((r) => ({
    x: (new Date(r.reading_at).getTime() - t0) / (1000 * 60 * 60),
    y: Number(r.value),
  }));

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const min = sensor.manual_override_min ?? sensor.hard_min;
  const max = sensor.manual_override_max ?? sensor.hard_max;
  const minBoundType: 'manual_min' | 'hard_min' = sensor.manual_override_min !== null ? 'manual_min' : 'hard_min';
  const maxBoundType: 'manual_max' | 'hard_max' = sensor.manual_override_max !== null ? 'manual_max' : 'hard_max';

  const currentX = points[n - 1].x;

  let boundApproaching: TrendProjection['boundApproaching'] = null;
  let crossingX: number | null = null;

  if (slope < 0 && min !== null) {
    boundApproaching = minBoundType;
    crossingX = (min - intercept) / slope;
  } else if (slope > 0 && max !== null) {
    boundApproaching = maxBoundType;
    crossingX = (max - intercept) / slope;
  }

  if (boundApproaching === null || crossingX === null || crossingX <= currentX) {
    return {
      sensorId,
      basedOnReadings: n,
      slopePerHour: Math.round(slope * 10000) / 10000,
      boundApproaching: null,
      projectedCrossingAt: null,
      message: 'Reading is stable or trending away from its threshold — no crossing projected from current data.',
    };
  }

  const hoursUntilCrossing = crossingX - currentX;
  const projectedDate = new Date(Date.now() + hoursUntilCrossing * 60 * 60 * 1000);

  return {
    sensorId,
    basedOnReadings: n,
    slopePerHour: Math.round(slope * 10000) / 10000,
    boundApproaching,
    projectedCrossingAt: projectedDate.toISOString(),
    message: `Linear trend projection based on ${n} real, unflagged readings — not an AI model. Treat as an early estimate, not a guarantee; accuracy improves with more history.`,
  };
}
