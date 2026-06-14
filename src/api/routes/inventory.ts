import { Router, Request, Response, NextFunction } from 'express';
import { getInventory, getAccommodation, saveAccommodation, invalidateInventoryCache } from '../../services/inventory.service';
import { Accommodation } from '../../integrations/google-sheets/inventory-repo';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const accommodations = await getInventory();
    res.json({ accommodations });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const acc = await getAccommodation(req.params.id);
    if (!acc) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ accommodation: acc });
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const acc: Accommodation = req.body;
    if (!acc.accommodation_id || !acc.name) {
      res.status(400).json({ error: 'accommodation_id and name are required' });
      return;
    }
    await saveAccommodation(acc);
    res.status(201).json({ accommodation: acc });
  } catch (err) { next(err); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const acc: Accommodation = { ...req.body, accommodation_id: req.params.id };
    await saveAccommodation(acc);
    res.json({ accommodation: acc });
  } catch (err) { next(err); }
});

router.post('/cache/invalidate', (_req: Request, res: Response) => {
  invalidateInventoryCache();
  res.json({ success: true });
});

export default router;
