import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Lang = 'en' | 'es';

type Dict = Record<string, { en: string; es: string }>;

const dict: Dict = {
  // App / nav
  app_title: { en: 'Hotel AI Agent', es: 'Agente IA Hotel' },
  app_subtitle: { en: 'Management Dashboard', es: 'Panel de Gestión' },
  nav_overview: { en: 'Overview', es: 'Resumen' },
  nav_conversations: { en: 'Conversations', es: 'Conversaciones' },
  nav_reservations: { en: 'Reservations', es: 'Reservaciones' },
  nav_inventory: { en: 'Inventory', es: 'Inventario' },
  nav_settings: { en: 'Settings', es: 'Configuración' },

  // Overview
  whatsapp: { en: 'WhatsApp', es: 'WhatsApp' },
  connected: { en: 'Connected', es: 'Conectado' },
  disconnected: { en: 'Disconnected', es: 'Desconectado' },
  starting_up: { en: 'Starting up — QR will appear here', es: 'Iniciando — el QR aparecerá aquí' },
  resetting: { en: 'Resetting — new QR coming...', es: 'Reiniciando — nuevo QR en camino...' },
  unlink_connected: { en: 'Unlink / Link a different number', es: 'Desvincular / Vincular otro número' },
  unlink_disconnected: { en: 'Reset & generate new QR', es: 'Reiniciar y generar nuevo QR' },
  default_agent_mode: { en: 'Default Agent Mode', es: 'Modo Predeterminado del Agente' },
  default_mode_hint_ai: { en: 'New chats start in AI mode', es: 'Los chats nuevos inician en modo IA' },
  default_mode_hint_human: { en: 'New chats start in Human mode', es: 'Los chats nuevos inician en modo Humano' },
  per_chat_hint: { en: 'Set per-chat mode in Conversations', es: 'Ajusta el modo por chat en Conversaciones' },
  sync_status: { en: 'Sync Status', es: 'Estado de Sincronización' },
  run_now: { en: 'Run now', es: 'Ejecutar' },
  no_report: { en: 'No report yet', es: 'Sin reporte aún' },
  last_run: { en: 'Last run', es: 'Última ejecución' },
  no_conflicts: { en: 'No conflicts', es: 'Sin conflictos' },
  conflicts: { en: 'conflict(s)', es: 'conflicto(s)' },
  repaired: { en: 'Repaired', es: 'Reparados' },
  live_feed: { en: 'Live Message Feed', es: 'Mensajes en Vivo' },
  messages: { en: 'messages', es: 'mensajes' },
  waiting_messages: { en: 'Waiting for messages...', es: 'Esperando mensajes...' },

  // Modes
  mode_ai: { en: 'AI', es: 'IA' },
  mode_human: { en: 'Human', es: 'Humano' },

  // Conversations
  conversations: { en: 'Conversations', es: 'Conversaciones' },
  no_conversations: { en: 'No conversations yet', es: 'Sin conversaciones aún' },
  select_conversation: { en: 'Select a conversation to view messages', es: 'Selecciona una conversación para ver los mensajes' },
  type_reply: { en: 'Type a reply...', es: 'Escribe una respuesta...' },
  send: { en: 'Send', es: 'Enviar' },
  ai_mode_active: { en: 'AI is handling this chat automatically. Switch to Human to take over.', es: 'La IA atiende este chat automáticamente. Cambia a Humano para tomar control.' },
  human_mode_active: { en: 'You are handling this chat manually.', es: 'Estás atendiendo este chat manualmente.' },
  guest: { en: 'Guest', es: 'Huésped' },
  you: { en: 'You', es: 'Tú' },

  // Reservations
  new_reservation: { en: 'New Reservation', es: 'Nueva Reservación' },
  search_reservations: { en: 'Search by name, phone, accommodation...', es: 'Buscar por nombre, teléfono, alojamiento...' },
  guest_col: { en: 'Guest', es: 'Huésped' },
  accommodation: { en: 'Accommodation', es: 'Alojamiento' },
  dates: { en: 'Dates', es: 'Fechas' },
  guests: { en: 'Guests', es: 'Huéspedes' },
  status: { en: 'Status', es: 'Estado' },
  no_reservations: { en: 'No reservations found', es: 'No se encontraron reservaciones' },
  loading: { en: 'Loading...', es: 'Cargando...' },

  // Inventory
  property_inventory: { en: 'Property Inventory', es: 'Inventario de Propiedades' },
  add_accommodation: { en: 'Add Accommodation', es: 'Agregar Alojamiento' },

  // Settings
  settings: { en: 'Settings', es: 'Configuración' },
  system_prompt: { en: 'System Prompt', es: 'Prompt del Sistema' },
  prompt_hint: { en: 'Changes take effect immediately — no restart required', es: 'Los cambios aplican de inmediato — sin reiniciar' },
  save_prompt: { en: 'Save Prompt', es: 'Guardar Prompt' },
  saved: { en: 'Saved!', es: '¡Guardado!' },
  saving: { en: 'Saving...', es: 'Guardando...' },
  business_config: { en: 'Business Configuration', es: 'Configuración del Negocio' },
  business_config_hint: { en: 'Edit the Config sheet — keys the AI uses (check-in time, policies, etc.)', es: 'Edita la hoja Config — datos que usa la IA (hora de entrada, políticas, etc.)' },
  config_key: { en: 'Key', es: 'Clave' },
  config_value: { en: 'Value', es: 'Valor' },
  config_description: { en: 'Description', es: 'Descripción' },
  add_config: { en: 'Add Config Entry', es: 'Agregar Entrada' },
  save: { en: 'Save', es: 'Guardar' },
  sync_validation: { en: 'Sync Validation', es: 'Validación de Sincronización' },
  reconcile_hint: { en: 'Reconcile Sheets ↔ Calendar', es: 'Reconciliar Hojas ↔ Calendario' },
  run_sync: { en: 'Run Sync Now', es: 'Sincronizar Ahora' },
  running: { en: 'Running...', es: 'Ejecutando...' },
  ai_model: { en: 'AI Model', es: 'Modelo de IA' },

  // Reservation modal
  modify: { en: 'Modify', es: 'Modificar' },
  field_guest_name: { en: 'Guest Name', es: 'Nombre del Huésped' },
  field_phone: { en: 'Phone', es: 'Teléfono' },
  field_email: { en: 'Email', es: 'Correo' },
  field_accommodation_id: { en: 'Accommodation ID', es: 'ID de Alojamiento' },
  field_checkin: { en: 'Check-in Date', es: 'Fecha de Entrada' },
  field_checkout: { en: 'Check-out Date', es: 'Fecha de Salida' },
  field_num_guests: { en: 'Number of Guests', es: 'Número de Huéspedes' },
  create_reservation_btn: { en: 'Create Reservation', es: 'Crear Reservación' },
  creating: { en: 'Creating...', es: 'Creando...' },
  save_changes: { en: 'Save Changes', es: 'Guardar Cambios' },

  // Accommodation modal
  edit_accommodation: { en: 'Edit Accommodation', es: 'Editar Alojamiento' },
  add_accommodation_title: { en: 'Add Accommodation', es: 'Agregar Alojamiento' },
  acc_id: { en: 'ID (e.g. CAB-001)', es: 'ID (ej. CAB-001)' },
  acc_name: { en: 'Name', es: 'Nombre' },
  acc_type: { en: 'Type (cabin/room/suite)', es: 'Tipo (cabaña/habitación/suite)' },
  acc_description: { en: 'Description', es: 'Descripción' },
  acc_status: { en: 'Status', es: 'Estado' },
  acc_max_guests: { en: 'Max Guests', es: 'Huéspedes Máx.' },
  acc_bedrooms: { en: 'Bedrooms', es: 'Habitaciones' },
  acc_bathrooms: { en: 'Bathrooms', es: 'Baños' },
  acc_price: { en: 'Price/Night', es: 'Precio/Noche' },
  acc_cleaning: { en: 'Cleaning Fee', es: 'Tarifa de Limpieza' },
  acc_tax: { en: 'Tax (%)', es: 'Impuesto (%)' },
  acc_min_stay: { en: 'Min Stay (nights)', es: 'Estancia Mín. (noches)' },
  acc_max_stay: { en: 'Max Stay (nights)', es: 'Estancia Máx. (noches)' },
  acc_amenities: { en: 'Amenities (comma-separated)', es: 'Servicios (separados por comas)' },
  save_accommodation: { en: 'Save Accommodation', es: 'Guardar Alojamiento' },

  // Theme
  theme: { en: 'Theme', es: 'Tema' },
  theme_light: { en: 'Light', es: 'Claro' },
  theme_dark: { en: 'Dark', es: 'Oscuro' },
  theme_system: { en: 'System', es: 'Sistema' },
  language: { en: 'Language', es: 'Idioma' },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict | string) => string;
}

const Ctx = createContext<I18nCtx>({ lang: 'es', setLang: () => {}, t: (k) => String(k) });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'es');

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  }, []);

  const t = useCallback((key: string) => {
    const entry = dict[key];
    return entry ? entry[lang] : key;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
