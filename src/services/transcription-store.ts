import { eventEmitter } from '../utils/events';

export interface VoiceTranscription {
  id: string;
  phone: string;       // clean display number
  jid: string;         // full WhatsApp JID
  transcript: string;
  durationSecs: number | null;
  mimeType: string;
  timestamp: string;
}

const MAX_STORED = 200;
const store: VoiceTranscription[] = [];
let seq = 0;

export function addTranscription(entry: Omit<VoiceTranscription, 'id'>): VoiceTranscription {
  const record: VoiceTranscription = { id: `vt-${++seq}`, ...entry };
  store.push(record);
  if (store.length > MAX_STORED) store.splice(0, store.length - MAX_STORED);

  eventEmitter.emit('voice:transcription', record);
  return record;
}

export function getTranscriptions(limit = 50): VoiceTranscription[] {
  return store.slice(-limit).reverse();
}

export function getTranscriptionsByPhone(phone: string, limit = 50): VoiceTranscription[] {
  return store.filter(t => t.phone === phone).slice(-limit).reverse();
}
