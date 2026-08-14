import { Router, Request, Response } from 'express';
import { getPgPoolOrThrow } from '../db/pg';
import { computeTrendProjection } from '../services/predictiveTrend';

const router = Router();

// NOTE: nothing currently writes to the predictions table — the Python
// backend/ai service referenced in docker-compose.yml isn't built yet.
// This route is real (queries actual Postgres), but will legitimately
// return an empty list until that service exists and starts inserting
// rows. That's honest; faking prediction data here would be the same
// mistake as the original spec's fabricated confidence scores.
router.get('/', async (_req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(`SELECT * FROM predictions ORDER BY created_at DESC`);
  res.json({
    predictions: rows,
    note: rows.length === 0 ? 'No predictions yet — the AI model service is not built. Rule-based alerts (see /api/v1/alerts) work independently of this.' : undefined,
  });
});

// GET /api/v1/predictions/trend/:sensorId — honest linear trend projection,
// see services/predictiveTrend.ts. Distinct from the ML predictions above:
// this is real math on real stored readings, not a model output.
router.get('/trend/:sensorId', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const projection = await computeTrendProjection(pool, req.params.sensorId);
  res.json({ trend: projection });
});

router.get('/segment/:segmentId', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(
    `SELECT * FROM predictions WHERE segment_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.params.segmentId],
  );
  res.json({ prediction: rows[0] ?? null });
});

router.get('/:id', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(`SELECT * FROM predictions WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Prediction not found' });
    return;
  }
  res.json({ prediction: rows[0] });
});

// POST /:id/feedback — real write to model_feedback, which is what
// getMlConfidenceIfValidated (alertEngine.ts) actually reads from.
router.post('/:id/feedback', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { actual_root_cause, was_correct, corrected_rul, technician_notes, submitted_by } = req.body;
  const predCheck = await pool.query(`SELECT id FROM predictions WHERE id = $1`, [req.params.id]);
  if (predCheck.rows.length === 0) {
    res.status(404).json({ error: 'Prediction not found' });
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO model_feedback (prediction_id, was_correct, actual_root_cause, corrected_rul, technician_notes, submitted_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.params.id, was_correct, actual_root_cause ?? null, corrected_rul ?? null, technician_notes ?? null, submitted_by ?? null],
  );
  res.json({
    status: 'accepted',
    message: 'Feedback recorded in model_feedback — this directly affects future ML confidence gating.',
    feedback_id: rows[0].id,
  });
});

export default router;
