import fs from 'fs';
import path from 'path';
import { chatCompletion, ChatMessage, ToolDefinition, ToolCall } from '../integrations/openrouter/client';
import { getAvailableAccommodations, checkAccommodationAvailability } from '../services/availability.service';
import { getActiveInventory, getAccommodation } from '../services/inventory.service';
import { calculatePrice, formatPriceBreakdown } from '../services/pricing.service';
import { createReservation, modifyReservation, cancelReservation } from '../services/reservation.service';
import { getReservationsByPhone } from '../integrations/google-sheets/reservation-repo';
import { getAllConfigValues } from '../integrations/google-sheets/reservation-repo';
import { getRecommendations } from '../services/recommendation.service';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── Conversation Store ────────────────────────────────────
const conversations = new Map<string, ChatMessage[]>();

function getHistory(phone: string): ChatMessage[] {
  if (!conversations.has(phone)) conversations.set(phone, []);
  return conversations.get(phone)!;
}

function pushHistory(phone: string, message: ChatMessage): void {
  const hist = getHistory(phone);
  hist.push(message);
  // Sliding window — keep system context headroom
  if (hist.length > config.agent.maxConversationHistory) {
    hist.splice(0, hist.length - config.agent.maxConversationHistory);
  }
}

// ─── System Prompt ─────────────────────────────────────────
const PROMPT_FILE = path.resolve(process.cwd(), 'system-prompt.txt');

let _promptOverride: string | null = null;

export function setSystemPrompt(prompt: string): void {
  _promptOverride = prompt;
  try {
    fs.writeFileSync(PROMPT_FILE, prompt, 'utf8');
  } catch { /* ignore */ }
}

export function getSystemPrompt(): string {
  if (_promptOverride) return _promptOverride;
  if (fs.existsSync(PROMPT_FILE)) return fs.readFileSync(PROMPT_FILE, 'utf8');
  return DEFAULT_SYSTEM_PROMPT;
}

async function buildSystemPrompt(isFirstMessage: boolean): Promise<string> {
  let base = getSystemPrompt();

  // Runtime turn signal so the slogan/greeting is only used on the very first
  // reply of a conversation, not repeated on every message.
  base += isFirstMessage
    ? `\n\n=== TURNO ACTUAL / CURRENT TURN ===
Este es el PRIMER mensaje del huésped en esta conversación. Incluye el saludo de bienvenida con el eslogan ahora.
This is the guest's FIRST message in this conversation. Include the welcome greeting with the slogan now.`
    : `\n\n=== TURNO ACTUAL / CURRENT TURN ===
Esta conversación YA ESTÁ EN CURSO. NO repitas el eslogan ni el saludo de bienvenida. Responde directamente.
This conversation is ALREADY IN PROGRESS. Do NOT repeat the slogan or the welcome greeting. Respond directly.`;
  try {
    const inventory = await getActiveInventory();
    const inventorySummary = inventory.map(a =>
      `- ${a.accommodation_id}: ${a.name} (${a.type}) | $${a.price_per_night}/noche | máx. ${a.max_guests} huéspedes | ${a.amenities.join(', ')}`
    ).join('\n');
    const businessConfig = await getAllConfigValues();
    const configStr = Object.entries(businessConfig).map(([k, v]) => `${k}: ${v}`).join('\n');
    base += `\n\n=== ALOJAMIENTOS DISPONIBLES ===\n${inventorySummary}`;
    if (configStr) base += `\n\n=== CONFIGURACIÓN DEL NEGOCIO ===\n${configStr}`;
  } catch (err) {
    logger.warn('Could not inject inventory into system prompt', { err });
  }
  return base;
}

// ─── Tool Definitions ──────────────────────────────────────
const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check which accommodations are available for given dates and guest count',
      parameters: {
        type: 'object',
        properties: {
          checkin_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
          checkout_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
          num_guests: { type: 'number', description: 'Number of guests (optional)' },
        },
        required: ['checkin_date', 'checkout_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_accommodation_details',
      description: 'Get full details of a specific accommodation by ID',
      parameters: {
        type: 'object',
        properties: {
          accommodation_id: { type: 'string' },
        },
        required: ['accommodation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_price',
      description: 'Calculate total cost for staying at an accommodation for given dates',
      parameters: {
        type: 'object',
        properties: {
          accommodation_id: { type: 'string' },
          checkin_date: { type: 'string', description: 'YYYY-MM-DD' },
          checkout_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['accommodation_id', 'checkin_date', 'checkout_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: 'Create a new reservation for a guest. Only call when you have all required info.',
      parameters: {
        type: 'object',
        properties: {
          guest_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          accommodation_id: { type: 'string' },
          checkin_date: { type: 'string' },
          checkout_date: { type: 'string' },
          num_guests: { type: 'number' },
        },
        required: ['guest_name', 'phone', 'accommodation_id', 'checkin_date', 'checkout_date', 'num_guests'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_reservation',
      description: 'Modify an existing reservation dates or guest count',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          new_checkin_date: { type: 'string' },
          new_checkout_date: { type: 'string' },
          new_num_guests: { type: 'number' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reservation',
      description: 'Cancel an existing reservation',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_reservations',
      description: 'List reservations for the current guest by phone number',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
        },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description: 'Get personalized accommodation recommendations based on guest preferences',
      parameters: {
        type: 'object',
        properties: {
          checkin_date: { type: 'string' },
          checkout_date: { type: 'string' },
          num_guests: { type: 'number' },
          max_budget: { type: 'number', description: 'Total budget in USD' },
          desired_amenities: { type: 'array', items: { type: 'string' } },
          accommodation_type: { type: 'string' },
        },
        required: ['checkin_date', 'checkout_date'],
      },
    },
  },
];

// ─── Tool Executor ─────────────────────────────────────────
async function executeTool(toolCall: ToolCall, phone: string): Promise<string> {
  const { name, arguments: argsStr } = toolCall.function;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments' });
  }

  try {
    switch (name) {
      case 'check_availability': {
        const available = await getAvailableAccommodations(
          args.checkin_date as string,
          args.checkout_date as string,
          args.num_guests as number | undefined
        );
        if (!available.length) return JSON.stringify({ available: false, message: 'No accommodations available for these dates' });
        return JSON.stringify({ available: true, accommodations: available.map(a => ({
          id: a.accommodation_id, name: a.name, type: a.type,
          price_per_night: a.price_per_night, max_guests: a.max_guests,
          amenities: a.amenities,
        }))});
      }

      case 'get_accommodation_details': {
        const acc = await getAccommodation(args.accommodation_id as string);
        if (!acc) return JSON.stringify({ error: 'Accommodation not found' });
        return JSON.stringify(acc);
      }

      case 'calculate_price': {
        const acc = await getAccommodation(args.accommodation_id as string);
        if (!acc) return JSON.stringify({ error: 'Accommodation not found' });
        const breakdown = calculatePrice(acc, args.checkin_date as string, args.checkout_date as string);
        return JSON.stringify({ ...breakdown, formatted: formatPriceBreakdown(breakdown) });
      }

      case 'create_reservation': {
        const reservation = await createReservation({
          guest_name: args.guest_name as string,
          phone: args.phone as string ?? phone,
          email: args.email as string | undefined,
          accommodation_id: args.accommodation_id as string,
          checkin_date: args.checkin_date as string,
          checkout_date: args.checkout_date as string,
          num_guests: args.num_guests as number,
        });
        return JSON.stringify({
          success: true,
          reservation_id: reservation.reservation_id,
          status: reservation.status,
          accommodation: reservation.accommodation_name,
          checkin: reservation.checkin_date,
          checkout: reservation.checkout_date,
        });
      }

      case 'modify_reservation': {
        const modified = await modifyReservation({
          reservation_id: args.reservation_id as string,
          new_checkin_date: args.new_checkin_date as string | undefined,
          new_checkout_date: args.new_checkout_date as string | undefined,
          new_num_guests: args.new_num_guests as number | undefined,
        });
        return JSON.stringify({ success: true, reservation: modified });
      }

      case 'cancel_reservation': {
        const cancelled = await cancelReservation(args.reservation_id as string);
        return JSON.stringify({ success: true, reservation_id: cancelled.reservation_id, status: 'Cancelled' });
      }

      case 'list_my_reservations': {
        const reservations = await getReservationsByPhone(args.phone as string ?? phone);
        const active = reservations.filter(r => r.status !== 'Cancelled');
        return JSON.stringify({ reservations: active });
      }

      case 'get_recommendations': {
        const recs = await getRecommendations({
          checkin_date: args.checkin_date as string,
          checkout_date: args.checkout_date as string,
          num_guests: args.num_guests as number | undefined,
          max_budget: args.max_budget as number | undefined,
          desired_amenities: args.desired_amenities as string[] | undefined,
          accommodation_type: args.accommodation_type as string | undefined,
        });
        return JSON.stringify({ recommendations: recs.map(r => ({
          accommodation: { id: r.accommodation.accommodation_id, name: r.accommodation.name, type: r.accommodation.type },
          total_price: r.total_price,
          match_reasons: r.match_reasons,
        }))});
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${name} failed`, { err: message });
    return JSON.stringify({ error: message });
  }
}

// ─── Main Agent Function ───────────────────────────────────
export async function processMessage(phone: string, userMessage: string): Promise<string> {
  // First message = no prior turns in history yet (checked before we push this one).
  const isFirstMessage = getHistory(phone).length === 0;
  const systemPrompt = await buildSystemPrompt(isFirstMessage);
  pushHistory(phone, { role: 'user', content: userMessage });

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...getHistory(phone),
  ];

  // Agentic loop — max 5 rounds of tool calls
  for (let round = 0; round < 5; round++) {
    const response = await chatCompletion(messages, TOOLS);

    if (response.tool_calls?.length) {
      // Add assistant message with tool calls
      messages.push({ role: 'assistant', content: response.content ?? '', tool_calls: response.tool_calls });

      // Execute all tool calls
      for (const toolCall of response.tool_calls) {
        logger.info(`Agent calling tool: ${toolCall.function.name}`, { phone });
        const result = await executeTool(toolCall, phone);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result,
        });
      }
      continue;
    }

    // Final response
    const reply = response.content ?? 'Lo siento, no pude procesar tu solicitud. / Sorry, I could not process your request.';
    pushHistory(phone, { role: 'assistant', content: reply });
    return reply;
  }

  return 'Ocurrió un error procesando tu solicitud. Por favor intenta de nuevo.';
}

export function clearConversation(phone: string): void {
  conversations.delete(phone);
}

export function getConversationHistory(phone: string): ChatMessage[] {
  return getHistory(phone);
}

// ─── Default System Prompt ─────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `Eres un agente de reservaciones bilingüe (Español/Inglés) para un hotel y cabañas.

REGLAS IMPORTANTES:
1. Detecta el idioma del huésped y responde siempre en ESE idioma.
2. NUNCA inventes precios, disponibilidad ni detalles de alojamientos. Usa SIEMPRE las herramientas para obtener información actualizada.
3. Para hacer una reservación necesitas: nombre completo, fechas de entrada y salida, número de huéspedes.
4. Antes de confirmar una reservación, muestra el resumen completo con el precio al huésped.
5. Sé amable, profesional y conciso.
6. Si el huésped pregunta por disponibilidad, SIEMPRE llama a check_availability primero.
7. NUNCA confirmes una reservación sin llamar a create_reservation.

You are a bilingual (Spanish/English) reservation agent for a hotel and cabins.

KEY RULES:
1. Detect the guest's language and always respond in THAT language.
2. NEVER make up prices, availability, or accommodation details. ALWAYS use tools to get current information.
3. To make a reservation you need: full name, check-in/check-out dates, number of guests.
4. Before confirming a reservation, show the guest a full summary with the price.
5. Be friendly, professional, and concise.
6. If the guest asks about availability, ALWAYS call check_availability first.
7. NEVER confirm a reservation without calling create_reservation.`;
