import type {
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ModelRegistration,
  ProviderAdapter,
  ToolDefinition,
} from './types';

export function createOpenAICompatAdapter(reg: ModelRegistration): ProviderAdapter {
  if (!reg.baseUrl) {
    throw new Error(`OpenAI-compat adapter for ${reg.modelId} requires baseUrl`);
  }
  const baseUrl = reg.baseUrl.replace(/\/$/, '');

  async function* chat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (reg.apiKey) headers.authorization = `Bearer ${reg.apiKey}`;

    const body = {
      model: reg.upstreamModel,
      messages: request.messages.map(toOpenAIMessage),
      stream: true,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      tools: request.tools?.map(toOpenAIToolDef),
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      yield { kind: 'finish', reason: 'error', error: `${res.status} ${text}` };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          yield { kind: 'finish', reason: 'stop' };
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            yield { kind: 'text', delta: delta.content };
          }
          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                yield {
                  kind: 'tool-call',
                  toolCall: {
                    id: tc.id ?? '',
                    name: tc.function.name,
                    arguments: safeJsonParse(tc.function.arguments ?? '{}'),
                  },
                };
              }
            }
          }
        } catch {
          // skip malformed line
        }
      }
    }
  }

  return { chat };
}

function toOpenAIMessage(msg: ChatMessage) {
  return {
    role: msg.role,
    content: msg.content,
    tool_calls: msg.toolCalls?.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    })),
    tool_call_id: msg.toolCallId,
  };
}

function toOpenAIToolDef(tool: ToolDefinition) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
