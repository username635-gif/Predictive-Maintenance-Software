import { Router, Request, Response } from 'express';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

// GET /api/v1/predictions  — all predictions
router.get('/', (_req: Request, res: Response) => {
  res.json({ predictions: mockDatabase.getPredictions() });
});

// GET /api/v1/predictions/segment/:segmentId  — prediction for a segment
router.get('/segment/:segmentId', (req: Request, res: Response) => {
  const prediction = mockDatabase.getPredictionForSegment(req.params.segmentId);
  if (!prediction) {
    res.json({ prediction: null });
    return;
  }
  res.json({ prediction });
});

// GET /api/v1/predictions/:id  — single prediction
router.get('/:id', (req: Request, res: Response) => {
  const prediction = mockDatabase.getPredictions().find((p) => p.id === req.params.id);
  if (!prediction) {
    res.status(404).json({ error: 'Prediction not found' });
    return;
  }
  res.json({ prediction });
});

// POST /api/v1/predictions/:id/feedback  — technician feedback loop
router.post('/:id/feedback', (req: Request, res: Response) => {
  const { actual_root_cause, was_correct, technician_notes } = req.body;
  const prediction = mockDatabase.getPredictions().find((p) => p.id === req.params.id);
  if (!prediction) {
    res.status(404).json({ error: 'Prediction not found' });
    return;
  }
  // In production, this would update the ML training pipeline
  console.log(`📝 Feedback for ${req.params.id}: correct=${was_correct}, actual_cause=${actual_root_cause}`);
  res.json({
    status: 'accepted',
    message: 'Feedback recorded. Model will be updated in next training cycle.',
    feedback_id: `FB-${Date.now()}`,
  });
});

export default router;
