import { Router, Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { getStatus, sendMessage, resetWhatsApp } from '../../integrations/whatsapp/client';
import { getConversations, getMessages, getRecentMessages, markRead, logMessage, displayNumber } from '../../services/message-log.service';
import { setConversationMode, getConversationMode } from '../../services/conversation-mode.service';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const s = getStatus();
  res.json({ connected: s.connected, phoneNumber: s.phoneNumber, reconnectCount: s.reconnectCount });
});

router.get('/qr', async (_req: Request, res: Response) => {
  const s = getStatus();
  if (s.connected) {
    res.json({ connected: true, qr: null });
    return;
  }
  if (!s.qr) {
    res.json({ connected: false, qr: null, message: 'QR not yet generated. Start the server and wait.' });
    return;
  }
  const qrImage = await QRCode.toDataURL(s.qr);
  res.json({ connected: false, qr: qrImage });
});

// Unlink the current account, wipe the session, and generate a fresh QR
router.post('/reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Fire and forget — reconnect happens asynchronously; the dashboard polls for the new QR
    resetWhatsApp().catch(() => { /* logged internally */ });
    res.json({ success: true, message: 'WhatsApp session reset — a new QR will appear shortly' });
  } catch (err) { next(err); }
});

// Recent messages across all chats — backfills the dashboard live feed on load
router.get('/recent', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  res.json({ messages: getRecentMessages(limit) });
});

// List all conversations (most recent first)
router.get('/conversations', (_req: Request, res: Response) => {
  res.json({ conversations: getConversations() });
});

// Get full message history for one conversation (keyed by JID)
router.get('/conversations/:jid', (req: Request, res: Response) => {
  const jid = decodeURIComponent(req.params.jid);
  markRead(jid);
  res.json({ messages: getMessages(jid), mode: getConversationMode(jid) });
});

// Set AI/Human mode for a single conversation
router.post('/conversations/:jid/mode', (req: Request, res: Response) => {
  const jid = decodeURIComponent(req.params.jid);
  const { mode } = req.body;
  if (mode !== 'ai' && mode !== 'human') {
    res.status(400).json({ error: 'mode must be "ai" or "human"' });
    return;
  }
  setConversationMode(jid, mode);
  res.json({ success: true, jid, mode });
});

// Send a manual reply (used in Human mode, but works any time)
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jid, text } = req.body;
    if (!jid || !text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'jid and non-empty text are required' });
      return;
    }
    await sendMessage(jid, text);
    logMessage({ jid, number: displayNumber(jid), direction: 'out', text, timestamp: new Date().toISOString(), via: 'human' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
