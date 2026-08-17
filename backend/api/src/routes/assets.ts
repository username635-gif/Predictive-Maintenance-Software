import { Router, Request, Response } from 'express';
import { computeHealthScore, computeAllHealthScores } from '../services/healthScore';

const router = Router();

// GET /api/v1/assets — list, each with route (jsonb, may be null) and a live-computed health_score
// health_score is a heuristic estimate derived from current open alerts, not a validated prediction.
router.get('/', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(`SELECT * FROM assets ORDER BY id`);
  const healthScores = await computeAllHealthScores(pool);

  const assets = rows.map((a) => {
    const h = healthScores.get(a.id);
    return {
      ...a,
      health_score: h?.healthScore ?? null,
      health_score_open_alerts: h?.openAlertCount ?? 0,
    };
  });

  res.json({ count: assets.length, assets });
});

// GET /api/v1/assets/:id — single asset with full health_score breakdown
router.get('/:id', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(`SELECT * FROM assets WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Asset not found', id: req.params.id });
    return;
  }
  const health = await computeHealthScore(pool, req.params.id);
  res.json({
    ...rows[0],
    health_score: health.healthScore,
    health_score_open_alerts: health.openAlertCount,
    health_score_breakdown: health.breakdown,
    health_score_factors: health.factors,
  });
});

export default router;
