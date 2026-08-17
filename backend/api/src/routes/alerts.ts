import { Router, Request, Response } from 'express';
import { auditLog } from '../middleware/auditLog';
import { requireRole } from '../middleware/authMiddleware';
import { recordIgnoredAndMaybeEscalate } from '../services/alertEngine';

const router = Router();

// GET /api/v1/alerts — real query, replaces mockDatabase.getAlerts()
router.get('/', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(
    `SELECT a.*, ast.name AS asset_name, ast.platform, ast.line, ast.zone
     FROM alerts a
     JOIN assets ast ON ast.id = a.asset_id
     ORDER BY a.created_at DESC`,
  );
  res.json({ alerts: rows });
});

// GET /api/v1/alerts/active — open/acknowledged/escalated only
router.get('/active', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(
    `SELECT a.*, ast.name AS asset_name, ast.platform, ast.line, ast.zone
     FROM alerts a
     JOIN assets ast ON ast.id = a.asset_id
     WHERE a.status IN ('open','acknowledged','escalated')
     ORDER BY
       CASE a.tier WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END,
       a.created_at DESC`,
  );
  res.json({ alerts: rows });
});

// GET /api/v1/alerts/bad-actors — ranked worst-performing assets.
// admin/manager only, same tier as roi.ts/export.
router.get('/bad-actors', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT
       ast.id AS asset_id,
       ast.name AS asset_name,
       ast.platform,
       ast.line,
       ast.zone,
       COUNT(a.id) AS alert_count,
       COUNT(a.id) FILTER (WHERE a.status IN ('open','acknowledged','escalated')) AS open_alert_count,
       COALESCE(SUM(a.cost_avoided_estimate), 0) AS total_cost_avoided,
       COALESCE(SUM(a.ignored_count), 0) AS total_ignored,
       MAX(a.created_at) AS most_recent_alert_at
     FROM assets ast
     LEFT JOIN alerts a ON a.asset_id = ast.id
     GROUP BY ast.id, ast.name, ast.platform, ast.line, ast.zone
     HAVING COUNT(a.id) > 0
     ORDER BY alert_count DESC, total_cost_avoided DESC
     LIMIT $1`,
    [limit],
  );

  res.json({ bad_actors: rows });
});

// POST /api/v1/alerts/:id/acknowledge
router.post(
  '/:id/acknowledge',
  auditLog({
    actionType: 'alert_ack',
    entityType: 'alert',
    entityId: (req) => req.params.id,
    previousState: async (req) => {
      const pool = req.orgPool!;
      const { rows } = await pool.query(`SELECT * FROM alerts WHERE id = $1`, [req.params.id]);
      return rows[0] ?? null;
    },
    newState: (_req, result) => result,
  }),
  async (req: Request, res: Response) => {
    const pool = req.orgPool!;
    const { rows } = await pool.query(
      `UPDATE alerts SET status = 'acknowledged', updated_at = now()
       WHERE id = $1 AND status IN ('open','escalated')
       RETURNING *`,
      [req.params.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Alert not found or not in an acknowledgeable state' });
      return;
    }
    res.json({ alert: rows[0], status: 'acknowledged' });
  },
);

// GET /api/v1/alerts/export — audit-trail CSV export. admin/manager only.
router.get('/export', requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  const pool = req.orgPool!;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (typeof req.query.from === 'string') {
    params.push(req.query.from);
    conditions.push(`a.created_at >= $${params.length}`);
  }
  if (typeof req.query.to === 'string') {
    params.push(req.query.to);
    conditions.push(`a.created_at <= $${params.length}`);
  }
  if (typeof req.query.status === 'string') {
    params.push(req.query.status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (typeof req.query.tier === 'string') {
    params.push(req.query.tier);
    conditions.push(`a.tier = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.id, ast.name AS asset_name, ast.platform, ast.line, ast.zone,
            a.tier, a.status, a.source, a.trigger_summary, a.recommended_action,
            a.confidence, a.cost_avoided_estimate, a.ignored_count, a.escalated_to,
            a.created_at, a.resolved_at, a.updated_at
     FROM alerts a
     JOIN assets ast ON ast.id = a.asset_id
     ${whereClause}
     ORDER BY a.created_at DESC`,
    params,
  );

  const columns = [
    'id', 'asset_name', 'platform', 'line', 'zone', 'tier', 'status', 'source',
    'trigger_summary', 'recommended_action', 'confidence', 'cost_avoided_estimate',
    'ignored_count', 'escalated_to', 'created_at', 'resolved_at', 'updated_at',
  ] as const;

  // FIX: pg returns timestamptz columns as JS Date objects. Previously this
  // just called String(value) on them, which uses JS's verbose default
  // format ("Tue Aug 11 2026 11:39:43 GMT+0200 (South Africa Standard
  // Time)") — bad for an audit document meant to be portable/importable.
  // Dates now get forced to a clean ISO 8601 string.
  const escapeCsvField = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.join(',');
  const dataLines = rows.map((row) => columns.map((col) => escapeCsvField(row[col])).join(','));
  const csv = [headerLine, ...dataLines].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="alerts_export_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// POST /api/v1/alerts/:id/ignore — Problem 2: never mutes, escalates after threshold
router.post('/:id/ignore', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const escalationTarget = req.body?.escalation_target ?? 'shift-supervisor';
  const check = await pool.query(`SELECT id FROM alerts WHERE id = $1`, [req.params.id]);
  if (check.rows.length === 0) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  const { escalated } = await recordIgnoredAndMaybeEscalate(pool, req.params.id, escalationTarget);
  res.json({ escalated, message: escalated ? `Escalated to ${escalationTarget}` : 'Ignore recorded' });
});

// POST /api/v1/alerts/:id/deliveries/:deliveryId/ack — Problem 2: "Reply ACK" receipt
router.post('/:id/deliveries/:deliveryId/ack', async (req: Request, res: Response) => {
  const pool = req.orgPool!;
  const { rows } = await pool.query(
    `UPDATE alert_deliveries SET acknowledged_at = now()
     WHERE id = $1 AND alert_id = $2 RETURNING *`,
    [req.params.deliveryId, req.params.id],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Delivery not found' });
    return;
  }
  res.json({ delivery: rows[0] });
});

export default router;
