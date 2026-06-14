import { sendMessage } from './client';
import { processMessage } from '../../agents/hotel-agent';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { logMessage, displayNumber } from '../../services/message-log.service';
import { getConversationMode } from '../../services/conversation-mode.service';

// Rate limiting: max 10 messages per minute per phone
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(phone, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

// Only real one-to-one customer chats should be handled. Reject WhatsApp status
// updates, channels/newsletters, and broadcast lists.
function isHandleableChat(jid: string): boolean {
  if (jid === 'status@broadcast') return false;
  if (jid.endsWith('@broadcast')) return false;
  if (jid.endsWith('@newsletter')) return false;
  if (isGroup(jid)) return !config.whatsapp.ignoreGroups;
  // Personal chats (@s.whatsapp.net) and privacy-masked users (@lid) are real people
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

export async function handleIncomingMessage(from: string, text: string): Promise<void> {
  if (!isHandleableChat(from)) {
    logger.debug(`Ignoring non-customer chat: ${from}`);
    return;
  }

  const jid = from;
  const number = displayNumber(from);
  const now = new Date().toISOString();

  logMessage({ jid, number, direction: 'in', text, timestamp: now, via: 'guest' });

  if (isRateLimited(jid)) {
    logger.warn(`Rate limit exceeded for ${number}`);
    return;
  }

  // Mode is tracked per conversation (keyed by JID)
  if (getConversationMode(jid) === 'human') {
    logger.info(`[HUMAN MODE] Message from ${number} logged — awaiting manual reply from dashboard`);
    return;
  }

  try {
    const reply = await processMessage(number, text);
    await sendMessage(jid, reply);
    logMessage({ jid, number, direction: 'out', text: reply, timestamp: new Date().toISOString(), via: 'ai' });
    logger.info(`Replied to ${number}`);
  } catch (err) {
    logger.error(`Failed to process/reply to ${number}`, { err });
    try {
      await sendMessage(from,
        'Lo siento, ocurrió un error. Por favor intenta de nuevo.\n' +
        'Sorry, an error occurred. Please try again.'
      );
    } catch { /* ignore send error */ }
  }
}
