import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
  WASocket,
  WAMessage,
  WAMessageContent,
  WAMessageKey,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { sleep } from '../../utils/retry';
import { isTranscriptionEnabled, transcribeAudio } from '../groq/whisper';
import { addTranscription } from '../../services/transcription-store';
import { displayNumber } from '../../services/message-log.service';

export interface WhatsAppStatus {
  connected: boolean;
  qr: string | null;
  phoneNumber: string | null;
  reconnectCount: number;
}

const status: WhatsAppStatus = {
  connected: false,
  qr: null,
  phoneNumber: null,
  reconnectCount: 0,
};

let sock: WASocket | null = null;
let messageHandler: ((from: string, text: string) => Promise<void>) | null = null;

// Cache of outgoing messages so Baileys can re-send them when a recipient's
// phone requests a retry (the cause of "Waiting for this message").
const sentMessages = new Map<string, WAMessageContent>();
const MAX_SENT_CACHE = 1000;

function cacheSentMessage(id: string | null | undefined, content: WAMessageContent | null | undefined): void {
  if (!id || !content) return;
  sentMessages.set(id, content);
  if (sentMessages.size > MAX_SENT_CACHE) {
    const firstKey = sentMessages.keys().next().value;
    if (firstKey) sentMessages.delete(firstKey);
  }
}

// De-duplication of incoming messages — Baileys can emit the same message twice
// (e.g. on retry receipts), which otherwise produces duplicate chat entries.
const processedMessageIds = new Set<string>();
const PROCESSED_ORDER: string[] = [];
const MAX_PROCESSED = 2000;

function alreadyProcessed(id: string | null | undefined): boolean {
  if (!id) return false;
  if (processedMessageIds.has(id)) return true;
  processedMessageIds.add(id);
  PROCESSED_ORDER.push(id);
  if (PROCESSED_ORDER.length > MAX_PROCESSED) {
    const old = PROCESSED_ORDER.shift();
    if (old) processedMessageIds.delete(old);
  }
  return false;
}

export function getStatus(): WhatsAppStatus {
  return { ...status };
}

export function setMessageHandler(handler: (from: string, text: string) => Promise<void>): void {
  messageHandler = handler;
}

// Flag so the auto-reconnect handler doesn't fight a deliberate logout.
let intentionalLogout = false;

// Unlinks the current WhatsApp account, wipes the saved session, and reconnects
// so a fresh QR is generated for linking a different account.
export async function resetWhatsApp(): Promise<void> {
  intentionalLogout = true;
  logger.info('Resetting WhatsApp session (dashboard request)...');

  try {
    if (sock) await sock.logout();
  } catch (err) {
    logger.warn('logout() failed (may already be disconnected)', { err });
  }

  try {
    sock?.end(undefined);
  } catch { /* ignore */ }
  sock = null;

  status.connected = false;
  status.qr = null;
  status.phoneNumber = null;
  status.reconnectCount = 0;

  // Wipe the auth folder
  const authDir = path.resolve(process.cwd(), 'auth');
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
    logger.info('Auth folder cleared');
  } catch (err) {
    logger.error('Failed to clear auth folder', { err });
  }

  // Reconnect to generate a fresh QR
  intentionalLogout = false;
  await connectWhatsApp();
}

export async function sendMessage(to: string, text: string): Promise<void> {
  if (!sock || !status.connected) throw new Error('WhatsApp not connected');
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  const sent = await sock.sendMessage(jid, { text });
  cacheSentMessage(sent?.key?.id, sent?.message);
}

export async function connectWhatsApp(): Promise<void> {
  const authDir = path.resolve(process.cwd(), 'auth');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baileysLogger: any = {
    level: 'silent',
    trace: () => {}, debug: () => {}, info: () => {},
    warn: (obj: unknown, msg?: string) => logger.warn(`[Baileys] ${msg ?? obj}`),
    error: (obj: unknown, msg?: string) => logger.error(`[Baileys] ${msg ?? obj}`),
    fatal: (obj: unknown, msg?: string) => logger.error(`[Baileys FATAL] ${msg ?? obj}`),
    child: () => baileysLogger,
  };

  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Using WhatsApp Web version ${version.join('.')} (isLatest: ${isLatest})`);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.appropriate('Chrome'),
    logger: baileysLogger,
    markOnlineOnConnect: true,
    // Lets Baileys re-encrypt & resend a message when the recipient requests a
    // retry — this is what clears "Waiting for this message" on the guest's phone.
    getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
      if (key.id && sentMessages.has(key.id)) return sentMessages.get(key.id);
      return undefined;
    },
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status.qr = qr;
      status.connected = false;
      logger.info('WhatsApp QR code generated — open http://localhost:3000/api/whatsapp/qr or check the dashboard at http://localhost:5173');
    }

    if (connection === 'open') {
      status.connected = true;
      status.qr = null;
      status.phoneNumber = sock?.user?.id?.split(':')[0] ?? null;
      logger.info(`WhatsApp connected: ${status.phoneNumber}`);
    }

    if (connection === 'connecting') {
      logger.debug('WhatsApp connecting...');
    }

    if (connection === 'close') {
      status.connected = false;

      // A deliberate reset (resetWhatsApp) handles its own reconnect — don't fight it here.
      if (intentionalLogout) {
        logger.info('Connection closed due to intentional logout — skipping auto-reconnect');
        return;
      }

      const boomErr = lastDisconnect?.error as Boom | undefined;
      const statusCode = boomErr?.output?.statusCode;
      const reasonName =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ?? 'unknown';

      logger.warn(`WhatsApp connection closed — statusCode=${statusCode} (${reasonName}) message="${boomErr?.message ?? 'n/a'}"`);

      if (statusCode === DisconnectReason.loggedOut) {
        logger.warn('WhatsApp logged out — use the dashboard "Unlink / Re-link" button or clear the auth/ folder to re-authenticate');
        status.reconnectCount = 0;
        return;
      }

      const delay = Math.min(3000 * 2 ** status.reconnectCount, 30000);
      status.reconnectCount++;
      logger.warn(`Reconnecting in ${delay}ms (attempt ${status.reconnectCount})`);
      await sleep(delay);
      await connectWhatsApp();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    logger.debug(`messages.upsert fired: type=${type}, count=${msgs.length}`);
    // 'notify' = new realtime messages. 'append' = history/own-device echoes — ignore.
    if (type !== 'notify') return;
    for (const msg of msgs) {
      if (msg.key.fromMe) {
        logger.debug('Skipping message: fromMe=true');
        continue;
      }
      if (!msg.message) {
        logger.debug('Skipping message: no message content (likely receipt/status)');
        continue;
      }
      if (alreadyProcessed(msg.key.id)) {
        logger.debug(`Skipping duplicate message: ${msg.key.id}`);
        continue;
      }

      const remoteJid = msg.key.remoteJid ?? '';
      if (!remoteJid) continue;

      // When a contact is addressed via LID (privacy-masked), Baileys exposes the
      // real phone-number JID in key.senderPn. Prefer it so we show/store the real number.
      const senderPn = msg.key.senderPn;
      let from = remoteJid;
      if (remoteJid.endsWith('@lid') && senderPn) {
        from = senderPn.includes('@') ? senderPn : `${senderPn}@s.whatsapp.net`;
      }

      let text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        msg.message.buttonsResponseMessage?.selectedDisplayText ||
        msg.message.listResponseMessage?.title ||
        '';

      // Voice notes / audio: transcribe to text and feed into the same handler.
      const audio = msg.message.audioMessage;
      if (!text.trim() && audio) {
        text = await handleVoiceNote(msg, from);
      }

      if (!text.trim()) {
        logger.debug(`Skipping message from ${from}: no extractable text (type=${Object.keys(msg.message).join(',')})`);
        continue;
      }

      logger.info(`WhatsApp message from ${from}: ${text.substring(0, 80)}`);

      if (messageHandler) {
        try {
          await messageHandler(from, text.trim());
        } catch (err) {
          logger.error('Message handler error', { err });
        }
      }
    }
  });
}

// ─── Voice note handling ─────────────────────────────────
// Downloads the audio, transcribes it via Groq Whisper, returns the text.
// If transcription is disabled or fails, sends a polite text fallback and returns ''
// so the message gets skipped (no AI call on empty text).
async function handleVoiceNote(msg: WAMessage, from: string): Promise<string> {
  logger.info(`Voice note received from ${from}`);

  if (!isTranscriptionEnabled()) {
    logger.warn('Voice transcription disabled (no GROQ_API_KEY) — sending fallback');
    try {
      await sock?.sendMessage(from, {
        text: 'Por ahora solo puedo procesar mensajes de texto. ¿Podrías escribir tu consulta?\n\n' +
              'For now I can only process text messages. Could you please type your message?',
      });
    } catch { /* ignore */ }
    return '';
  }

  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    if (!buffer || !(buffer instanceof Buffer)) {
      throw new Error('Empty audio buffer');
    }
    const mime = msg.message?.audioMessage?.mimetype ?? 'audio/ogg';
    const durationSecs = msg.message?.audioMessage?.seconds ?? null;
    const transcript = await transcribeAudio(buffer, mime);
    if (!transcript.trim()) {
      throw new Error('Empty transcript');
    }

    addTranscription({
      phone: displayNumber(from),
      jid: from,
      transcript,
      durationSecs,
      mimeType: mime,
      timestamp: new Date().toISOString(),
    });

    return transcript;
  } catch (err) {
    logger.error(`Voice transcription failed for ${from}`, { err: err instanceof Error ? err.message : err });
    try {
      await sock?.sendMessage(from, {
        text: 'No pude entender tu nota de voz. ¿Podrías escribirla?\n\n' +
              "I couldn't understand your voice note. Could you type it instead?",
      });
    } catch { /* ignore */ }
    return '';
  }
}
