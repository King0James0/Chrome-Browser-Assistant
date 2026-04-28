import type { ModelRouter } from '../router';
import type { ChatMessage, ChatRequest, ToolCall } from '../router/types';
import { v1Tools } from '../tools';

export interface AgentRequest {
  router: ModelRouter;
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  history: ChatMessage[];
  onChunk: (text: string) => void;
  onToolCall: (call: ToolCall) => Promise<unknown>;
  maxIterations?: number;
}

export async function runAgent(req: AgentRequest): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: req.systemPrompt },
    ...req.history,
    { role: 'user', content: req.userMessage },
  ];

  const max = req.maxIterations ?? 8;
  for (let i = 0; i < max; i += 1) {
    const chatReq: ChatRequest = {
      modelId: req.modelId,
      messages,
      tools: v1Tools,
    };
    const pendingToolCalls: ToolCall[] = [];
    let assistantText = '';

    for await (const chunk of req.router.chat(chatReq)) {
      if (chunk.kind === 'text') {
        assistantText += chunk.delta;
        req.onChunk(chunk.delta);
      } else if (chunk.kind === 'tool-call') {
        pendingToolCalls.push(chunk.toolCall);
      } else if (chunk.kind === 'finish') {
        if (chunk.reason === 'error') {
          throw new Error(chunk.error ?? 'unknown router error');
        }
        break;
      }
    }

    messages.push({
      role: 'assistant',
      content: assistantText,
      toolCalls: pendingToolCalls.length ? pendingToolCalls : undefined,
    });

    if (pendingToolCalls.length === 0) return messages;

    for (const call of pendingToolCalls) {
      const result = await req.onToolCall(call);
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }
  }

  return messages;
}
