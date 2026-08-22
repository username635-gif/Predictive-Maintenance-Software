import { Router, Request, Response } from 'express';
import { evaluateReading } from '../services/mqttConsumer';

const router = Router();

// POST /api/v1/sensors/bulk
// Called by edge/gateway.py's sync_to_cloud() -- NOT the frontend, NOT
// JWT-authenticated. Mounted with requireGatewayKey (see server.ts), which
// sets req.orgPool from the gateway's API key before this handler runs.
//
// Body shape matches gateway.py's get_unsynced() output exactly:
//   { gateway_id: string, readings: [{ sensor_id, segment_id, timestamp,
//     value, unit, quality }] }
// segment_id/unit/quality are accepted in the payload but not used here --
// evaluateReading resolves the sensor's real asset_id and unit from the
// sensors table itself, not from what the gateway claims. `quality` is
// edge-local adapter-confidence metadata, separate from is_flagged_bad
// (which evaluateReading derives independently via flatline/jump
// detection) -- deliberately not conflated with it.
router.post('/', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const body = req.body ?? {};
  const readings = Array.isArray(body.readings) ? body.readings : null;
  if (!readings) {
    res.status(400).json({ error: 'Missing or invalid field: readings (expected array)' });
    return;
  }

  type IncomingReading = { sensor_id?: unknown; timestamp?: unknown; value?: unknown };
  const valid: { sensorId: string; timestamp: string; value: number }[] = [];
  const errors: { sensor_id: string | null; error: string }[] = [];

  (readings as IncomingReading[]).forEach((r) => {
    const sensorId = typeof r.sensor_id === 'string' ? r.sensor_id : null;
    if (sensorId === null || typeof r.timestamp !== 'string') {
      errors.push({ sensor_id: sensorId, error: 'Missing required field (sensor_id, timestamp)' });
      return;
    }
    const value = Number(r.value);
    if (Number.isNaN(value)) {
      errors.push({ sensor_id: sensorId, error: `Non-numeric value: ${String(r.value)}` });
      return;
    }
    valid.push({ sensorId, timestamp: r.timestamp, value });
  });

  // Same requirement as the CSV backfill path: evaluateReading's
  // flatline/breach-confirmation state is sequence-dependent per sensor. A
  // gateway that was BUFFERED and is now flushing a backlog can send
  // readings spanning real time gaps -- must be evaluated in true
  // chronological order per sensor, not request-array order.
  valid.sort((a, b) => {
    if (a.sensorId !== b.sensorId) return a.sensorId < b.sensorId ? -1 : 1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  let processed = 0;
  for (const r of valid) {
    try {
      // Unlike CSV backfill: no suppressDelivery, no skipDwellTick. This is
      // a reconnecting gateway flushing a short real buffer, not a year of
      // vendor history -- real alerts should notify, dwell should tick
      // normally.
      await evaluateReading(pool, r.sensorId, r.value, { readingTimestamp: r.timestamp });
      processed++;
    } catch (e) {
      errors.push({
        sensor_id: r.sensorId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (req.gatewayId) {
    try {
      await pool.query(`UPDATE gateways SET last_seen_at = now(), status = 'online' WHERE id = $1`, [req.gatewayId]);
    } catch (e) {
      console.error('[sensors/bulk] failed to update gateway last_seen_at', e);
    }
  }

  res.json({ total: readings.length, processed, error_count: errors.length, errors: errors.slice(0, 50) });
});

export default router;


