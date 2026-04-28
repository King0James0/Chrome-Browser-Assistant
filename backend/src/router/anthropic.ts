import type {
  ChatChunk,
  ChatMessage,
  ChatRequest,
  ModelRegistration,
  ProviderAdapter,
} from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export function createAnthropicAdapter(reg: ModelRegistration): ProviderAdapter {
  if (!reg.apiKey) {
    throw new Error(`Anthropic adapter for ${reg.modelId} requires apiKey`);
  }
  const apiKey = reg.apiKey;

  async function* chat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { system, messages } = splitSystem(request.messages);
    const body = {
      model: reg.upstreamModel,
      messages,
      system,
      stream: true,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
      tools: request.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
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
    const partialToolCalls: Record<number, { id: string; name: string; argsBuffer: string }> = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            yield { kind: 'text', delta: evt.delta.text };
          } else if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
            partialToolCalls[evt.index] = {
              id: evt.content_block.id,
              name: evt.content_block.name,
              argsBuffer: '',
            };
          } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'input_json_delta') {
            const partial = partialToolCalls[evt.index];
            if (partial) partial.argsBuffer += evt.delta.partial_json ?? '';
          } else if (evt.type === 'content_block_stop') {
            const partial = partialToolCalls[evt.index];
            if (partial) {
              yield {
                kind: 'tool-call',
                toolCall: {
                  id: partial.id,
                  name: partial.name,
                  arguments: safeJsonParse(partial.argsBuffer),
                },
              };
              delete partialToolCalls[evt.index];
            }
          } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
            const reason: 'stop' | 'tool_calls' | 'length' =
              evt.delta.stop_reason === 'tool_use'
                ? 'tool_calls'
                : evt.delta.stop_reason === 'max_tokens'
                  ? 'length'
                  : 'stop';
            yield { kind: 'finish', reason };
          }
        } catch {
          // skip malformed event
        }
      }
    }
  }

  return { chat };
}

function splitSystem(messages: ChatMessage[]) {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const others = messages.filter((m) => m.role !== 'system');
  return {
    system: systemMsgs.map((m) => m.content).join('\n\n') || undefined,
    messages: others.map(toAnthropicMessage),
  };
}

function toAnthropicMessage(msg: ChatMessage) {
  if (msg.role === 'tool') {
    return {
      role: 'user' as const,
      content: [{ type: 'tool_result', tool_use_id: msg.toolCallId, content: msg.content }],
    };
  }
  if (msg.toolCalls?.length) {
    const blocks: unknown[] = [];
    if (msg.content) blocks.push({ type: 'text', text: msg.content });
    for (const tc of msg.toolCalls) {
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
    }
    return { role: msg.role, content: blocks };
  }
  return { role: msg.role, content: msg.content };
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}
