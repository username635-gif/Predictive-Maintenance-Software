import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/v1/roi/summary
router.get('/summary', async (req: Request, res: Response) => {
  const pool = req.orgPool!;

  const coverage = await pool.query<{ total: string; with_cost: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE replacement_cost IS NOT NULL OR downtime_cost_per_hour IS NOT NULL) AS with_cost
     FROM assets`,
  );
  const totalAssets = Number(coverage.rows[0].total);
  const assetsWithCost = Number(coverage.rows[0].with_cost);

  const avoided = await pool.query<{ total_cost_avoided: string | null; resolved_count: string }>(
    `SELECT SUM(cost_avoided_estimate) AS total_cost_avoided, COUNT(*) AS resolved_count
     FROM alerts WHERE status = 'resolved'`,
  );
  const totalCostAvoided = Number(avoided.rows[0].total_cost_avoided ?? 0);
  const resolvedCount = Number(avoided.rows[0].resolved_count);

  res.json({
    total_cost_avoided: totalCostAvoided,
    resolved_alerts_counted: resolvedCount,
    data_coverage: {
      assets_total: totalAssets,
      assets_with_cost_data: assetsWithCost,
      note: assetsWithCost < totalAssets
        ? `Only ${assetsWithCost} of ${totalAssets} assets have cost data entered — this figure reflects those only, not the full fleet.`
        : 'All assets have cost data entered.',
    },
  });
});

// GET /api/v1/roi/history — monthly rollup of resolved alerts' cost_avoided_estimate
router.get('/history', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', resolved_at), 'Mon YYYY') AS month,
            COUNT(*) AS resolved_count,
            SUM(cost_avoided_estimate) AS total_cost_avoided
     FROM alerts
     WHERE status = 'resolved' AND resolved_at IS NOT NULL
     GROUP BY date_trunc('month', resolved_at)
     ORDER BY date_trunc('month', resolved_at)`,
  );
  res.json({
    history: rows,
    note: rows.length === 0
      ? 'No resolved alerts yet — history will populate as real alerts move through the pipeline and resolve.'
      : undefined,
  });
});

export default router;