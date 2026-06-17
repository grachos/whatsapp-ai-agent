import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export function isTranscriptionEnabled(): boolean {
  return !!config.groq.apiKey;
}

/**
 * Transcribes an audio buffer using Groq's Whisper API.
 * Returns the recognised text, or throws on failure.
 *
 * @param audio    Raw audio bytes (WhatsApp voice notes are .ogg/opus).
 * @param mimeType e.g. "audio/ogg"; used to build the filename so Whisper detects format.
 */
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
  if (!config.groq.apiKey) throw new Error('GROQ_API_KEY not configured');

  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('wav') ? 'wav'
    : mimeType.includes('webm') ? 'webm'
    : 'mp3';

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${ext}`);
  form.append('model', config.groq.whisperModel);
  form.append('response_format', 'json');
  // Don't send a `language` field at all — Whisper auto-detects ES/EN/etc.
  // Sending an empty string is treated as an invalid ISO code (400 error).

  const start = Date.now();
  try {
    const res = await axios.post(GROQ_TRANSCRIBE_URL, form, {
      headers: { Authorization: `Bearer ${config.groq.apiKey}` },
      timeout: 30_000,
      maxBodyLength: Infinity,
    });
    const text = (res.data?.text ?? '').trim();
    logger.info(`Whisper transcribed ${audio.length} bytes (${mimeType}) in ${Date.now() - start}ms: "${text.substring(0, 80)}"`);
    return text;
  } catch (err) {
    // Surface the actual Groq error body — usually pinpoints the problem
    // (invalid key / unknown model / unsupported format / quota).
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const body = err.response?.data;
      logger.error(
        `Groq Whisper API error: status=${status} model=${config.groq.whisperModel} mime=${mimeType} bytes=${audio.length} body=${JSON.stringify(body)}`
      );
    } else {
      logger.error('Groq Whisper unknown error', { err });
    }
    throw err;
  }
}
