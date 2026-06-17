import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const schema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_KEY: z.string().min(1, 'API_KEY is required'),

  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),

  // Optional — enables voice-note transcription via Groq Whisper.
  // Without it, voice notes get a polite "voice not supported" reply.
  GROQ_API_KEY: z.string().optional(),
  GROQ_WHISPER_MODEL: z.string().default('whisper-large-v3-turbo'),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email('Invalid Google service account email'),
  GOOGLE_PRIVATE_KEY: z.string().min(1, 'GOOGLE_PRIVATE_KEY is required'),

  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1, 'GOOGLE_SHEETS_SPREADSHEET_ID is required'),
  INVENTORY_SHEET_NAME: z.string().default('Inventory'),
  RESERVATIONS_SHEET_NAME: z.string().default('Reservations'),
  CONFIG_SHEET_NAME: z.string().default('Config'),

  GOOGLE_CALENDAR_ID: z.string().default('primary'),

  WHATSAPP_IGNORE_GROUPS: z.string().transform(v => v === 'true').default('true'),
  SYNC_INTERVAL_MINUTES: z.string().transform(Number).default('15'),
  LOCK_TTL_SECONDS: z.string().transform(Number).default('30'),
  MAX_CONVERSATION_HISTORY: z.string().transform(Number).default('20'),
  INVENTORY_CACHE_TTL_SECONDS: z.string().transform(Number).default('120'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  apiKey: parsed.data.API_KEY,

  openrouter: {
    apiKey: parsed.data.OPENROUTER_API_KEY,
    model: parsed.data.OPENROUTER_MODEL,
    baseUrl: parsed.data.OPENROUTER_BASE_URL,
  },

  groq: {
    apiKey: parsed.data.GROQ_API_KEY,
    whisperModel: parsed.data.GROQ_WHISPER_MODEL,
  },

  google: {
    serviceAccountEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: parsed.data.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    spreadsheetId: parsed.data.GOOGLE_SHEETS_SPREADSHEET_ID,
    inventorySheetName: parsed.data.INVENTORY_SHEET_NAME,
    reservationsSheetName: parsed.data.RESERVATIONS_SHEET_NAME,
    configSheetName: parsed.data.CONFIG_SHEET_NAME,
    calendarId: parsed.data.GOOGLE_CALENDAR_ID,
  },

  whatsapp: {
    ignoreGroups: parsed.data.WHATSAPP_IGNORE_GROUPS,
  },

  sync: {
    intervalMinutes: parsed.data.SYNC_INTERVAL_MINUTES,
  },

  lock: {
    ttlSeconds: parsed.data.LOCK_TTL_SECONDS,
  },

  agent: {
    maxConversationHistory: parsed.data.MAX_CONVERSATION_HISTORY,
    mode: 'ai' as 'ai' | 'human',
  },

  inventory: {
    cacheTtlSeconds: parsed.data.INVENTORY_CACHE_TTL_SECONDS,
  },
};

export type Config = typeof config;
