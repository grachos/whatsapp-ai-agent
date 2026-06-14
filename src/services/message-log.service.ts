import { eventEmitter } from '../utils/events';
import { getConversationMode, AgentMode } from './conversation-mode.service';

export type MessageDirection = 'in' | 'out';

export interface LoggedMessage {
  jid: string;        // full WhatsApp JID (used for sending)
  number: string;     // clean display number
  direction: MessageDirection;
  text: string;
  timestamp: string;
  via: 'ai' | 'human' | 'guest' | 'system';
}

export interface ConversationSummary {
  jid: string;
  number: string;
  lastMessage: string;
  lastTimestamp: string;
  lastDirection: MessageDirection;
  unread: number;
  mode: AgentMode;
}

// Derive a human-friendly number/label from a WhatsApp JID.
export function displayNumber(jid: string): string {
  const local = jid.split('@')[0];
  if (jid.endsWith('@g.us')) return `Grupo ${local.slice(0, 8)}`;
  return local; // @s.whatsapp.net and @lid both expose the numeric part
}

// In-memory store keyed by full JID
const conversations = new Map<string, LoggedMessage[]>();
const unreadCounts = new Map<string, number>();
const MAX_PER_CONVERSATION = 200;

export function logMessage(msg: LoggedMessage): void {
  if (!conversations.has(msg.jid)) conversations.set(msg.jid, []);
  const list = conversations.get(msg.jid)!;
  list.push(msg);
  if (list.length > MAX_PER_CONVERSATION) list.splice(0, list.length - MAX_PER_CONVERSATION);

  if (msg.direction === 'in') {
    unreadCounts.set(msg.jid, (unreadCounts.get(msg.jid) ?? 0) + 1);
  }

  eventEmitter.emit(msg.direction === 'in' ? 'message:incoming' : 'message:outgoing', {
    phone: msg.number,
    text: msg.text,
    timestamp: msg.timestamp,
    via: msg.via,
  });
}

export function getConversations(): ConversationSummary[] {
  const summaries: ConversationSummary[] = [];
  for (const [jid, list] of conversations.entries()) {
    if (!list.length) continue;
    const last = list[list.length - 1];
    summaries.push({
      jid,
      number: last.number,
      lastMessage: last.text,
      lastTimestamp: last.timestamp,
      lastDirection: last.direction,
      unread: unreadCounts.get(jid) ?? 0,
      mode: getConversationMode(jid),
    });
  }
  return summaries.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));
}

export function getMessages(jid: string): LoggedMessage[] {
  return conversations.get(jid) ?? [];
}

export function markRead(jid: string): void {
  unreadCounts.set(jid, 0);
}
