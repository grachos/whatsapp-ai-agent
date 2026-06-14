import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterResponse {
  content: string | null;
  tool_calls: ToolCall[] | null;
  model: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  tools?: ToolDefinition[]
): Promise<OpenRouterResponse> {
  const body: Record<string, unknown> = {
    model: config.openrouter.model,
    messages,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await axios.post(
    `${config.openrouter.baseUrl}/chat/completions`,
    body,
    {
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hotel-agent.local',
        'X-Title': 'Hotel AI Agent',
      },
      timeout: 30000,
    }
  );

  const choice = res.data.choices?.[0];
  const message = choice?.message;

  logger.debug('OpenRouter response', {
    model: res.data.model,
    finish_reason: choice?.finish_reason,
    tool_calls: message?.tool_calls?.length ?? 0,
  });

  return {
    content: message?.content ?? null,
    tool_calls: message?.tool_calls ?? null,
    model: res.data.model,
  };
}
