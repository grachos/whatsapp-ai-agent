import { Router, Request, Response } from 'express';
import { getTranscriptions, getTranscriptionsByPhone } from '../../services/transcription-store';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  res.json({ transcriptions: getTranscriptions(limit) });
});

router.get('/phone/:phone', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  res.json({ transcriptions: getTranscriptionsByPhone(req.params.phone, limit) });
});

export default router;
