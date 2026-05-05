import { Router, Request, Response } from 'express';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

// GET /api/v1/roi/summary
router.get('/summary', (_req: Request, res: Response) => {
  res.json(mockDatabase.getROISummary());
});

// GET /api/v1/roi/history
router.get('/history', (_req: Request, res: Response) => {
  res.json({ history: mockDatabase.getROIHistory() });
});

export default router;
