import type { WSMessage } from '../shared/types';

export type MessageListener = (msg: WSMessage) => void;

const listeners = new Set<MessageListener>();

chrome.runtime.onMessage.addListener((msg: WSMessage) => {
  for (const l of listeners) l(msg);
});

export function onMessage(listener: MessageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function sendMessage(msg: WSMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

export async function probeBackend(): Promise<boolean> {
  const resp = (await chrome.runtime.sendMessage({ kind: 'ping' } satisfies WSMessage)) as
    | WSMessage
    | undefined;
  return resp?.kind === 'pong' ? resp.connected : false;
}
