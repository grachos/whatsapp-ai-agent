import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { getSystemPrompt, setSystemPrompt, clearConversation, getConversationHistory } from '../../agents/hotel-agent';
import { getConversations } from '../../services/message-log.service';
import { setConversationMode } from '../../services/conversation-mode.service';

const router = Router();

router.get('/prompt', (_req: Request, res: Response) => {
  res.json({ prompt: getSystemPrompt() });
});

router.put('/prompt', (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'prompt must be a non-empty string' });
    return;
  }
  setSystemPrompt(prompt);
  res.json({ success: true, message: 'Prompt updated — takes effect immediately' });
});

// Global default mode — applies to conversations without a per-chat override
router.get('/mode', (_req: Request, res: Response) => {
  res.json({ mode: config.agent.mode });
});

router.post('/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (mode !== 'ai' && mode !== 'human') {
    res.status(400).json({ error: 'mode must be "ai" or "human"' });
    return;
  }
  // Set the default for new chats AND apply to every existing conversation
  config.agent.mode = mode;
  const conversations = getConversations();
  for (const c of conversations) {
    setConversationMode(c.jid, mode);
  }
  res.json({ success: true, mode, appliedTo: conversations.length });
});

router.delete('/conversations/:phone', (req: Request, res: Response) => {
  clearConversation(req.params.phone);
  res.json({ success: true });
});

router.get('/conversations/:phone', (req: Request, res: Response) => {
  const history = getConversationHistory(req.params.phone);
  res.json({ history });
});

export default router;
