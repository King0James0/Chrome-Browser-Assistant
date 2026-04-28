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
    if (reg.stripLeadingThinking) {
      yield* stripThinking(rawChat(request));
      return;
    }
    yield* rawChat(request);
  }

  async function* rawChat(request: ChatRequest): AsyncIterable<ChatChunk> {
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
    const partialCalls = new Map<number, { id: string; name: string; argsBuffer: string }>();
    let finished = false;

    function* flushToolCalls(): Generator<ChatChunk> {
      for (const partial of partialCalls.values()) {
        if (!partial.name) continue;
        yield {
          kind: 'tool-call',
          toolCall: {
            id: partial.id,
            name: partial.name,
            arguments: safeJsonParse(partial.argsBuffer || '{}'),
          },
        };
      }
      partialCalls.clear();
    }

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
          if (!finished) {
            yield* flushToolCalls();
            yield { kind: 'finish', reason: 'stop' };
            finished = true;
          }
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          const finishReason: string | null | undefined = json.choices?.[0]?.finish_reason;

          if (delta?.content) {
            yield { kind: 'text', delta: delta.content };
          }

          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx: number = typeof tc.index === 'number' ? tc.index : 0;
              let partial = partialCalls.get(idx);
              if (!partial) {
                partial = { id: '', name: '', argsBuffer: '' };
                partialCalls.set(idx, partial);
              }
              if (tc.id) partial.id = tc.id;
              if (tc.function?.name) partial.name = tc.function.name;
              if (typeof tc.function?.arguments === 'string') {
                partial.argsBuffer += tc.function.arguments;
              }
            }
          }

          if (finishReason && !finished) {
            yield* flushToolCalls();
            const reason: 'stop' | 'tool_calls' | 'length' =
              finishReason === 'tool_calls'
                ? 'tool_calls'
                : finishReason === 'length'
                  ? 'length'
                  : 'stop';
            yield { kind: 'finish', reason };
            finished = true;
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

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

async function* stripThinking(input: AsyncIterable<ChatChunk>): AsyncIterable<ChatChunk> {
  let inThinking = true;
  let buffer = '';
  let trimLeading = true;

  function consume(text: string): string {
    if (!trimLeading) return text;
    const trimmed = text.replace(/^\s+/, '');
    if (trimmed) trimLeading = false;
    return trimmed;
  }

  for await (const chunk of input) {
    if (chunk.kind !== 'text') {
      yield chunk;
      continue;
    }
    if (inThinking) {
      buffer += chunk.delta;
      const idx = buffer.indexOf(CLOSE_TAG);
      if (idx === -1) continue;
      const after = buffer.slice(idx + CLOSE_TAG.length);
      buffer = '';
      inThinking = false;
      if (after) {
        const re = processAfterClose(after);
        const out = consume(re.emit);
        if (out) yield { kind: 'text', delta: out };
        if (re.reEnterBuffer !== undefined) {
          inThinking = true;
          buffer = re.reEnterBuffer;
          trimLeading = true;
        }
      }
    } else {
      const re = processAfterClose(chunk.delta);
      const out = consume(re.emit);
      if (out) yield { kind: 'text', delta: out };
      if (re.reEnterBuffer !== undefined) {
        inThinking = true;
        buffer = re.reEnterBuffer;
        trimLeading = true;
      }
    }
  }
}

function processAfterClose(text: string): { emit: string; reEnterBuffer?: string } {
  const open = text.indexOf(OPEN_TAG);
  if (open === -1) return { emit: text };
  return {
    emit: text.slice(0, open),
    reEnterBuffer: text.slice(open + OPEN_TAG.length),
  };
}
