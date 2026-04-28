export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  modelId: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export type ChatChunk =
  | { kind: 'text'; delta: string }
  | { kind: 'tool-call'; toolCall: ToolCall }
  | { kind: 'finish'; reason: 'stop' | 'tool_calls' | 'length' | 'error'; error?: string };

export interface ProviderAdapter {
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export interface ModelRegistration {
  modelId: string;
  provider: 'openai-compat' | 'anthropic';
  baseUrl?: string;
  apiKey?: string;
  upstreamModel: string;
}
