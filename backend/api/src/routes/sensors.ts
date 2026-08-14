import { Router, Request, Response } from 'express';
import { getPgPoolOrThrow } from '../db/pg';
import { getLastKnownReading } from '../services/mqttConsumer';

const router = Router();

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // no reading in 5 min = offline

function liveStatus(sensorId: string): { status: 'online' | 'offline'; last_value: number | null; last_seen: string | null } {
  const reading = getLastKnownReading(sensorId);
  if (!reading) return { status: 'offline', last_value: null, last_seen: null };
  const ageMs = Date.now() - new Date(reading.timestamp).getTime();
  return {
    status: ageMs <= ONLINE_WINDOW_MS ? 'online' : 'offline',
    last_value: reading.value,
    last_seen: reading.timestamp,
  };
}

// GET /api/v1/sensors — real query, replaces mockDatabase.getSensors()
router.get('/', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { asset_id, type } = req.query;

  let query = `SELECT s.*, a.name AS asset_name, a.platform, a.latitude, a.longitude
               FROM sensors s JOIN assets a ON a.id = s.asset_id WHERE 1=1`;
  const params: string[] = [];

  if (typeof asset_id === 'string') {
    params.push(asset_id);
    query += ` AND s.asset_id = $${params.length}`;
  }
  if (typeof type === 'string') {
    params.push(type);
    query += ` AND s.sensor_type = $${params.length}`;
  }

  const { rows } = await pool.query(query, params);
  const sensors = rows.map((s) => ({ ...s, ...liveStatus(s.id) }));

  res.json({ count: sensors.length, sensors });
});

// GET /api/v1/sensors/:id — single sensor detail
router.get('/:id', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(
    `SELECT s.*, a.name AS asset_name, a.platform, a.latitude, a.longitude
     FROM sensors s JOIN assets a ON a.id = s.asset_id WHERE s.id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Sensor not found', id: req.params.id });
    return;
  }
  res.json({ ...rows[0], ...liveStatus(rows[0].id) });
});

// GET /api/v1/sensors/health/summary
router.get('/health/summary', async (_req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(`SELECT id FROM sensors`);
  let online = 0;
  let offline = 0;
  for (const row of rows) {
    if (liveStatus(row.id).status === 'online') online++;
    else offline++;
  }
  // 'degraded' isn't computed yet — that needs a real signal quality metric
  // (e.g. reading variance, gateway heartbeat health) that doesn't exist
  // in this schema yet. Reporting it as 0 here would be dishonest; omitting
  // the field is more accurate than faking a number.
  res.json({ total: rows.length, online, offline, degraded: 'not yet implemented' });
});

export default router;