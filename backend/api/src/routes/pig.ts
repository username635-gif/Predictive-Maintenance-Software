import { Router, Request, Response } from 'express';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ pig_runs: mockDatabase.getPIGRuns() });
});

router.get('/segment/:segmentId', (req: Request, res: Response) => {
  const runs = mockDatabase.getPIGRuns().filter((r) => r.segment_id === req.params.segmentId);
  res.json({ pig_runs: runs });
});

export default router;
