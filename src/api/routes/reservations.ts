import { Router, Request, Response, NextFunction } from 'express';
import {
  createReservation,
  modifyReservation,
  cancelReservation,
  getAllReservations,
  getReservationById,
} from '../../services/reservation.service';
import { getReservationsByPhone } from '../../integrations/google-sheets/reservation-repo';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const reservations = await getAllReservations();
    res.json({ reservations });
  } catch (err) { next(err); }
});

router.get('/by-phone/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservations = await getReservationsByPhone(req.params.phone);
    res.json({ reservations });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await getReservationById(req.params.id);
    if (!reservation) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ reservation });
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await createReservation(req.body);
    res.status(201).json({ reservation });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await modifyReservation({
      reservation_id: req.params.id,
      ...req.body,
    });
    res.json({ reservation });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await cancelReservation(req.params.id);
    res.json({ reservation });
  } catch (err) { next(err); }
});

export default router;
