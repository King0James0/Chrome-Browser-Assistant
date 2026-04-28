import { config } from '../config';
import { createAnthropicAdapter } from './anthropic';
import { createOpenAICompatAdapter } from './openai-compat';
import type { ChatChunk, ChatRequest, ModelRegistration, ProviderAdapter } from './types';

export class ModelRouter {
  private adapters = new Map<string, ProviderAdapter>();
  private registrations = new Map<string, ModelRegistration>();

  register(reg: ModelRegistration): void {
    this.registrations.set(reg.modelId, reg);
    this.adapters.set(
      reg.modelId,
      reg.provider === 'anthropic'
        ? createAnthropicAdapter(reg)
        : createOpenAICompatAdapter(reg),
    );
  }

  list(): ModelRegistration[] {
    return [...this.registrations.values()];
  }

  chat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const adapter = this.adapters.get(request.modelId);
    if (!adapter) return errorIterable(`unknown model: ${request.modelId}`);
    return adapter.chat(request);
  }
}

async function* errorIterable(msg: string): AsyncIterable<ChatChunk> {
  yield { kind: 'finish', reason: 'error', error: msg };
}

export function buildRouterFromConfig(): ModelRouter {
  const router = new ModelRouter();
  const p = config.providers;

  if (p.anthropic.apiKey) {
    router.register({
      modelId: 'anthropic',
      provider: 'anthropic',
      apiKey: p.anthropic.apiKey,
      upstreamModel: p.anthropic.model,
    });
  }

  if (p.openai.apiKey) {
    router.register({
      modelId: 'openai',
      provider: 'openai-compat',
      baseUrl: p.openai.baseUrl,
      apiKey: p.openai.apiKey,
      upstreamModel: p.openai.model,
    });
  }

  if (p.openrouter.apiKey) {
    router.register({
      modelId: 'openrouter',
      provider: 'openai-compat',
      baseUrl: p.openrouter.baseUrl,
      apiKey: p.openrouter.apiKey,
      upstreamModel: p.openrouter.model,
    });
  }

  if (p.ollama.baseUrl && p.ollama.model) {
    router.register({
      modelId: 'ollama',
      provider: 'openai-compat',
      baseUrl: p.ollama.baseUrl,
      upstreamModel: p.ollama.model,
    });
  }

  if (p.vllm.baseUrl && p.vllm.model) {
    router.register({
      modelId: 'vllm',
      provider: 'openai-compat',
      baseUrl: p.vllm.baseUrl,
      upstreamModel: p.vllm.model,
    });
  }

  if (p.lmStudio.baseUrl && p.lmStudio.model) {
    router.register({
      modelId: 'lmstudio',
      provider: 'openai-compat',
      baseUrl: p.lmStudio.baseUrl,
      upstreamModel: p.lmStudio.model,
    });
  }

  return router;
}

export type {
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ModelRegistration,
  ProviderAdapter,
  ToolCall,
  ToolDefinition,
} from './types';
