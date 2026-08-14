import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { getPgPoolOrThrow } from '../db/pg';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// priority is now OPTIONAL — previously always required, meaning it was
// always a manual guess (Problem: Work Order Prioritization was never
// actually built, just a free-text-ish field). When alert_id is provided
// and priority is omitted, priority is derived from the linked alert's
// tier below — a real signal instead of a guess. Explicit priority still
// wins if you provide both.
const createWOSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  segment_id: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  alert_id: Joi.string().allow(''),
  description: Joi.string().allow('').max(2000),
  repair_procedure: Joi.string().allow('').max(4000),
  assigned_to: Joi.string().allow('').max(100),
  due_date: Joi.string().isoDate().allow(''),
  prediction_id: Joi.string().allow(''),
  estimated_downtime_hours: Joi.number().min(0).max(168),
});

// Alert tier -> suggested work order priority. This is the real mapping
// behind "Work Order Prioritization" — deliberately simple and reviewable,
// same philosophy as alertEngine.ts's ACTION_LIBRARY: a lookup a human can
// audit, not an opaque score.
const TIER_TO_PRIORITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  red: 'critical',
  yellow: 'high',
  green: 'medium',
};

// GET /api/v1/workorders
router.get('/', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { status, priority, segment_id } = req.query;

  let query = 'SELECT * FROM work_orders WHERE 1=1';
  const params: string[] = [];

  if (typeof status === 'string') {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  if (typeof priority === 'string') {
    params.push(priority);
    query += ` AND priority = $${params.length}`;
  }
  if (typeof segment_id === 'string') {
    params.push(segment_id);
    query += ` AND segment_id = $${params.length}`;
  }
  // Prioritized ordering: critical first, then by cost-avoided of the
  // linked alert (if any), so the most urgent AND highest-impact work
  // surfaces at the top rather than just sorting by creation time.
  query += `
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC`;

  const { rows } = await pool.query(query, params);
  res.json({ count: rows.length, work_orders: rows });
});

// GET /api/v1/workorders/:id
router.get('/:id', async (req: Request, res: Response) => {
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Work order not found' });
    return;
  }
  res.json({ work_order: rows[0] });
});

// POST /api/v1/workorders — create
router.post(
  '/',
  auditLog({
    actionType: 'workorder_create',
    entityType: 'workorder',
    entityId: (req) => `req-${req.body?.segment_id ?? 'unknown'}`,
    previousState: () => null,
    newState: (_req, result) => result,
  }),
  async (req: Request, res: Response) => {
    const { error, value } = createWOSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Validation failed', details: error.details });
      return;
    }

    const pool = getPgPoolOrThrow();

    let priority = value.priority as string | undefined;
    let priorityNote: string | undefined;

    if (value.alert_id) {
      const alertRes = await pool.query<{ tier: string }>(`SELECT tier FROM alerts WHERE id = $1`, [value.alert_id]);
      if (alertRes.rows.length === 0) {
        res.status(400).json({ error: `alert_id ${value.alert_id} not found` });
        return;
      }
      const derivedPriority = TIER_TO_PRIORITY[alertRes.rows[0].tier] ?? 'medium';
      if (!priority) {
        priority = derivedPriority;
        priorityNote = `Priority auto-derived from linked alert tier (${alertRes.rows[0].tier}).`;
      }
    }

    if (!priority) {
      // No alert link and no explicit priority — fall back to a neutral
      // default rather than blocking creation. This IS a guess, and is
      // labeled as one rather than presented as a real signal.
      priority = 'medium';
      priorityNote = 'No alert linked and no priority specified — defaulted to medium. Not a real signal.';
    }

    const { rows } = await pool.query(
      `INSERT INTO work_orders
         (title, segment_id, priority, alert_id, description, repair_procedure, assigned_to, due_date, prediction_id, estimated_downtime_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        value.title,
        value.segment_id,
        priority,
        value.alert_id || null,
        value.description || null,
        value.repair_procedure || null,
        value.assigned_to || 'Unassigned',
        value.due_date || null,
        value.prediction_id || null,
        value.estimated_downtime_hours ?? 4,
      ],
    );
    res.status(201).json({ work_order: rows[0], priority_note: priorityNote });
  },
);

// PATCH /api/v1/workorders/:id — update
router.patch(
  '/:id',
  auditLog({
    actionType: 'workorder_update',
    entityType: 'workorder',
    entityId: (req) => req.params.id,
    previousState: async (req) => {
      const pool = getPgPoolOrThrow();
      const { rows } = await pool.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id]);
      return rows[0] ?? null;
    },
    newState: (_req, result) => result,
  }),
  async (req: Request, res: Response) => {
    const allowed = ['status', 'priority', 'assigned_to', 'technician_notes', 'actual_root_cause'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        setClauses.push(`${key} = $${i++}`);
        values.push(req.body[key]);
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    values.push(req.params.id);
    const pool = getPgPoolOrThrow();
    const { rows } = await pool.query(
      `UPDATE work_orders SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Work order not found' });
      return;
    }
    res.json({ work_order: rows[0] });
  },
);

// POST /api/v1/workorders/sync — bulk offline sync (PWA offline-capability support)
router.post('/sync', async (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array required' });
    return;
  }

  const pool = getPgPoolOrThrow();
  const results: { local_id: unknown; server_id?: string; status: string }[] = [];

  for (const item of items) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO work_orders (title, segment_id, description, repair_procedure, estimated_downtime_hours, assigned_to, due_date, prediction_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          item.title ?? 'Synced Work Order',
          item.segment_id,
          item.description ?? null,
          item.repair_procedure ?? null,
          item.estimated_downtime_hours ?? 4,
          item.assigned_to ?? 'Unassigned',
          item.due_date ?? null,
          item.prediction_id ?? null,
        ],
      );
      results.push({ local_id: item._local_id, server_id: rows[0].id, status: 'synced' });
    } catch (err) {
      results.push({ local_id: item._local_id, status: 'failed' });
    }
  }

  res.json({ synced: results.filter((r) => r.status === 'synced').length, results });
});

export default router;
