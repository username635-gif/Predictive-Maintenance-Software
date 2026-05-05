import { Router, Request, Response, NextFunction } from 'express';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

// GET /api/v1/sensors  — full list with optional filtering
router.get('/', (req: Request, res: Response) => {
  const { segment_id, type, status } = req.query;
  let sensors = mockDatabase.getSensors();

  if (typeof segment_id === 'string') {
    sensors = sensors.filter((s) => s.segment_id === segment_id);
  }
  if (typeof type === 'string') {
    sensors = sensors.filter((s) => s.type === type);
  }
  if (typeof status === 'string') {
    sensors = sensors.filter((s) => s.status === status);
  }

  res.json({ count: sensors.length, sensors });
});

// GET /api/v1/sensors/:id  — single sensor detail
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  const sensor = mockDatabase.getSensors().find((s) => s.id === req.params.id);
  if (!sensor) {
    res.status(404).json({ error: 'Sensor not found', id: req.params.id });
    return;
  }

  // Generate last 24 hours of simulated history
  const readings = Array.from({ length: 24 }, (_, i) => {
    const [lo, hi] = sensor.normal_range;
    const value = (lo + hi) / 2 + (Math.random() - 0.5) * (hi - lo) * 0.4;
    return {
      timestamp: new Date(Date.now() - (23 - i) * 3_600_000).toISOString(),
      value: +value.toFixed(3),
      quality: sensor.quality,
    };
  });

  res.json({ ...sensor, readings });
});

// GET /api/v1/sensors/health/summary  — health stats
router.get('/health/summary', (_req: Request, res: Response) => {
  const sensors = mockDatabase.getSensors();
  const online = sensors.filter((s) => s.status === 'online').length;
  const degraded = sensors.filter((s) => s.status === 'degraded').length;
  const offline = sensors.filter((s) => s.status === 'offline').length;
  res.json({ total: sensors.length, online, degraded, offline });
});

export default router;
