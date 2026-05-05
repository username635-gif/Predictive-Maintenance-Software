import { Router, Request, Response } from 'express';
import { mockDatabase } from '../data/mockDatabase';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ alerts: mockDatabase.getAlerts() });
});

router.get('/active', (_req: Request, res: Response) => {
  res.json({ alerts: mockDatabase.getActiveAlerts() });
});

router.post('/:id/acknowledge', (req: Request, res: Response) => {
  const alert = mockDatabase.acknowledgeAlert(req.params.id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json({ alert, status: 'acknowledged' });
});

export default router;
