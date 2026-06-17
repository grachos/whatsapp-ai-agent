const API_KEY = import.meta.env.VITE_API_KEY ?? 'change-me-dashboard-secret';
const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// WhatsApp
export const getWhatsAppStatus = () => request<{ connected: boolean; phoneNumber: string | null }>('/whatsapp/status');
export const getQR = () => request<{ connected: boolean; qr: string | null }>('/whatsapp/qr');
export const resetWhatsApp = () => request<{ success: boolean }>('/whatsapp/reset', { method: 'POST' });
export const getRecentMessages = (limit = 50) =>
  request<{ messages: LoggedMessage[] }>(`/whatsapp/recent?limit=${limit}`);

// Conversations (identified by full JID — must be URL-encoded in the path)
export const getConversations = () =>
  request<{ conversations: ConversationSummary[] }>('/whatsapp/conversations');
export const getConversationMessages = (jid: string) =>
  request<{ messages: LoggedMessage[]; mode: 'ai' | 'human' }>(`/whatsapp/conversations/${encodeURIComponent(jid)}`);
export const sendManualMessage = (jid: string, text: string) =>
  request('/whatsapp/send', { method: 'POST', body: JSON.stringify({ jid, text }) });
export const setConversationMode = (jid: string, mode: 'ai' | 'human') =>
  request(`/whatsapp/conversations/${encodeURIComponent(jid)}/mode`, { method: 'POST', body: JSON.stringify({ mode }) });

// Business Config (Config sheet)
export const getBusinessConfig = () => request<{ config: ConfigRow[] }>('/config');
export const saveBusinessConfig = (row: ConfigRow) =>
  request<{ config: ConfigRow }>('/config', { method: 'PUT', body: JSON.stringify(row) });

// Agent
export const getAgentMode = () => request<{ mode: 'ai' | 'human' }>('/agent/mode');
export const setAgentMode = (mode: 'ai' | 'human') =>
  request('/agent/mode', { method: 'POST', body: JSON.stringify({ mode }) });
export const getPrompt = () => request<{ prompt: string }>('/agent/prompt');
export const savePrompt = (prompt: string) =>
  request('/agent/prompt', { method: 'PUT', body: JSON.stringify({ prompt }) });

// Reservations
export const getReservations = () => request<{ reservations: Reservation[] }>('/reservations');
export const createReservation = (data: Partial<Reservation>) =>
  request<{ reservation: Reservation }>('/reservations', { method: 'POST', body: JSON.stringify(data) });
export const cancelReservation = (id: string) =>
  request<{ reservation: Reservation }>(`/reservations/${id}`, { method: 'DELETE' });
export const modifyReservation = (id: string, data: Record<string, unknown>) =>
  request<{ reservation: Reservation }>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// Inventory
export const getInventory = () => request<{ accommodations: Accommodation[] }>('/inventory');
export const saveAccommodation = (acc: Accommodation) =>
  request<{ accommodation: Accommodation }>(`/inventory/${acc.accommodation_id}`, {
    method: 'PUT', body: JSON.stringify(acc),
  });

// Sync
export const runSync = () => request<{ report: SyncReport }>('/sync/run', { method: 'POST' });
export const getSyncReport = () => request<{ report: SyncReport }>('/sync/report');

// Transcriptions
export const getTranscriptions = (limit = 50) =>
  request<{ transcriptions: VoiceTranscription[] }>(`/transcriptions?limit=${limit}`);

// Types
export interface Reservation {
  reservation_id: string;
  guest_name: string;
  phone: string;
  email: string;
  accommodation_id: string;
  accommodation_name: string;
  accommodation_type: string;
  checkin_date: string;
  checkout_date: string;
  num_guests: number;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
  calendar_event_id: string;
  created_at: string;
  updated_at: string;
}

export interface Accommodation {
  accommodation_id: string;
  name: string;
  type: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  price_per_night: number;
  cleaning_fee: number;
  taxes_pct: number;
  amenities: string[];
  description: string;
  images: string[];
  min_stay: number;
  max_stay: number;
}

export interface ConversationSummary {
  jid: string;
  number: string;
  lastMessage: string;
  lastTimestamp: string;
  lastDirection: 'in' | 'out';
  unread: number;
  mode: 'ai' | 'human';
}

export interface ConfigRow {
  key: string;
  value: string;
  description: string;
}

export interface LoggedMessage {
  jid: string;
  number: string;
  direction: 'in' | 'out';
  text: string;
  timestamp: string;
  via: 'ai' | 'human' | 'guest' | 'system';
}

export interface VoiceTranscription {
  id: string;
  phone: string;
  jid: string;
  transcript: string;
  durationSecs: number | null;
  mimeType: string;
  timestamp: string;
}

export interface SyncReport {
  ranAt: string;
  orphanedCalendarEvents: string[];
  missingCalendarEvents: string[];
  conflicts: { reservation_id: string; conflicts_with: string }[];
  repairedCount: number;
  errors: string[];
}
