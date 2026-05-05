import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

const createWOSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  segment_id: Joi.string().pattern(/^SEG-\d{3}$/).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  description: Joi.string().allow('').max(2000),
  assigned_to: Joi.string().allow('').max(100),
  due_date: Joi.string().isoDate().allow(''),
  prediction_id: Joi.string().allow(''),
  estimated_downtime_hours: Joi.number().min(0).max(168),
  safety_notes: Joi.array().items(Joi.string()).max(20),
  parts_list: Joi.array().items(
    Joi.object({
      part_number: Joi.string().required(),
      description: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
      in_stock: Joi.boolean(),
    })
  ).max(50),
});

// GET /api/v1/workorders
router.get('/', (req: Request, res: Response) => {
  const { status, priority, segment_id } = req.query;
  let wos = mockDatabase.getWorkOrders();

  if (typeof status === 'string') wos = wos.filter((w) => w.status === status);
  if (typeof priority === 'string') wos = wos.filter((w) => w.priority === priority);
  if (typeof segment_id === 'string') wos = wos.filter((w) => w.segment_id === segment_id);

  res.json({ count: wos.length, work_orders: wos });
});

// GET /api/v1/workorders/:id
router.get('/:id', (req: Request, res: Response) => {
  const wo = mockDatabase.getWorkOrders().find((w) => w.id === req.params.id);
  if (!wo) {
    res.status(404).json({ error: 'Work order not found' });
    return;
  }
  res.json({ work_order: wo });
});

// POST /api/v1/workorders — create
router.post('/', (req: Request, res: Response) => {
  const { error, value } = createWOSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Validation failed', details: error.details });
    return;
  }
  const wo = mockDatabase.createWorkOrder(value);
  res.status(201).json({ work_order: wo });
});

// PATCH /api/v1/workorders/:id — update
router.patch('/:id', (req: Request, res: Response) => {
  const allowed = ['status', 'priority', 'assigned_to', 'technician_notes', 'actual_root_cause'];
  const updates: Record<string, unknown> = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const wo = mockDatabase.updateWorkOrder(req.params.id, updates);
  if (!wo) {
    res.status(404).json({ error: 'Work order not found' });
    return;
  }
  res.json({ work_order: wo });
});

// POST /api/v1/workorders/sync — bulk offline sync
router.post('/sync', (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items array required' });
    return;
  }
  const results = items.map((item: Record<string, unknown>) => {
    const wo = mockDatabase.createWorkOrder(item);
    return { local_id: item._local_id, server_id: wo.id, status: 'synced' };
  });
  res.json({ synced: results.length, results });
});

export default router;
