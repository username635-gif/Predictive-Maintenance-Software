import { Router, Request, Response } from 'express';
import { mockDatabase } from '../data/mockDatabase';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ alerts: mockDatabase.getAlerts() });
});

router.get('/active', (_req: Request, res: Response) => {
  res.json({ alerts: mockDatabase.getActiveAlerts() });
});

router.post('/:id/acknowledge', auditLog({

  actionType: 'alert_ack',
  entityType: 'alert',
  entityId: (req) => req.params.id,
  previousState: (req) => {
    const alert = mockDatabase.getAlerts().find((a) => a.id === req.params.id);
    return alert ? { ...alert } : null;
  },
  newState: (_req, result) => result,
}), (req: Request, res: Response) => {
  const alert = mockDatabase.acknowledgeAlert(req.params.id);
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json({ alert, status: 'acknowledged' });
});


export default router;
