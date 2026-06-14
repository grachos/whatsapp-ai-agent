import { config } from '../config';

export type AgentMode = 'ai' | 'human';

// Per-phone overrides. If a phone has no entry, the global default applies.
const overrides = new Map<string, AgentMode>();

export function getDefaultMode(): AgentMode {
  return config.agent.mode;
}

export function setDefaultMode(mode: AgentMode): void {
  config.agent.mode = mode;
}

export function getConversationMode(phone: string): AgentMode {
  return overrides.get(phone) ?? config.agent.mode;
}

export function setConversationMode(phone: string, mode: AgentMode): void {
  overrides.set(phone, mode);
}

export function clearConversationMode(phone: string): void {
  overrides.delete(phone);
}

export function hasOverride(phone: string): boolean {
  return overrides.has(phone);
}
