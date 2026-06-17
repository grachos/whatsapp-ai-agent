import { Router, Request, Response } from 'express';
import { requireApiKey } from '../middleware/auth';
import whatsappRouter from './routes/whatsapp';
import agentRouter from './routes/agent';
import reservationsRouter from './routes/reservations';
import inventoryRouter from './routes/inventory';
import syncRouter from './routes/sync';
import configRouter from './routes/config';
import transcriptionsRouter from './routes/transcriptions';
import { eventEmitter } from '../utils/events';
import { config } from '../config';

const router = Router();

// Public health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SSE event stream for dashboard real-time feed.
// EventSource cannot send custom headers, so the API key arrives as a query param.
router.get('/events', (req: Request, res: Response) => {
  const key = (req.query.key as string) ?? (req.headers['x-api-key'] as string);
  if (!key || key !== config.apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onIncoming = (d: unknown) => send('message:incoming', d);
  const onOutgoing = (d: unknown) => send('message:outgoing', d);
  const onTranscription = (d: unknown) => send('voice:transcription', d);

  eventEmitter.on('message:incoming', onIncoming);
  eventEmitter.on('message:outgoing', onOutgoing);
  eventEmitter.on('voice:transcription', onTranscription);

  req.on('close', () => {
    eventEmitter.off('message:incoming', onIncoming);
    eventEmitter.off('message:outgoing', onOutgoing);
    eventEmitter.off('voice:transcription', onTranscription);
  });

  // Keep-alive ping every 30s
  const ping = setInterval(() => res.write(': ping\n\n'), 30_000);
  req.on('close', () => clearInterval(ping));
});

// Protected routes
router.use('/whatsapp', requireApiKey, whatsappRouter);
router.use('/agent', requireApiKey, agentRouter);
router.use('/reservations', requireApiKey, reservationsRouter);
router.use('/inventory', requireApiKey, inventoryRouter);
router.use('/sync', requireApiKey, syncRouter);
router.use('/config', requireApiKey, configRouter);
router.use('/transcriptions', requireApiKey, transcriptionsRouter);

export default router;
