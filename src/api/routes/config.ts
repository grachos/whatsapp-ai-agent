import { Router, Request, Response, NextFunction } from 'express';
import { getConfigRows, upsertConfigRow, ConfigRow } from '../../integrations/google-sheets/reservation-repo';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await getConfigRows();
    res.json({ config: rows });
  } catch (err) { next(err); }
});

router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row: ConfigRow = {
      key: (req.body.key ?? '').trim(),
      value: req.body.value ?? '',
      description: req.body.description ?? '',
    };
    if (!row.key) {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    await upsertConfigRow(row);
    res.json({ success: true, config: row });
  } catch (err) { next(err); }
});

export default router;
