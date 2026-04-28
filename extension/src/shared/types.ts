export interface PageContext {
  url: string;
  title: string;
  selectedText?: string;
  outline?: string;
}

export type WSMessage =
  | { kind: 'chat-request'; tabId: number; text: string; modelId: string; pageContext?: PageContext }
  | { kind: 'chat-response'; chunk: string; done: boolean }
  | { kind: 'tool-call'; tool: string; args: Record<string, unknown> }
  | { kind: 'tool-result'; result: unknown; error?: string }
  | { kind: 'toggle-overlay' }
  | { kind: 'ping' }
  | { kind: 'pong'; connected: boolean }
  | { kind: 'error'; message: string };
