import type { WSMessage } from '../shared/types';

const BACKEND_WS_URL = 'ws://127.0.0.1:50090/ws';
const RECONNECT_DELAY_MS = 5000;

let socket: WebSocket | null = null;

function connect(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  socket = new WebSocket(BACKEND_WS_URL);

  socket.addEventListener('open', () => {
    console.log('[bg] connected to backend');
  });

  socket.addEventListener('close', () => {
    console.log('[bg] backend disconnected; retrying in', RECONNECT_DELAY_MS, 'ms');
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  socket.addEventListener('error', (err) => {
    console.warn('[bg] socket error', err);
  });

  socket.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data) as WSMessage;
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (err) {
      console.warn('[bg] failed to parse backend message', err);
    }
  });
}

chrome.runtime.onInstalled.addListener(connect);
chrome.runtime.onStartup.addListener(connect);

chrome.runtime.onMessage.addListener((msg: WSMessage, _sender, sendResponse) => {
  if (msg.kind === 'ping') {
    const reply: WSMessage = {
      kind: 'pong',
      connected: socket?.readyState === WebSocket.OPEN,
    };
    sendResponse(reply);
    return false;
  }
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
    sendResponse({ ok: true });
  } else {
    sendResponse({ ok: false, error: 'backend not connected' });
  }
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-overlay') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId !== undefined) {
      chrome.tabs.sendMessage(tabId, { kind: 'toggle-overlay' }).catch(() => {});
    }
  });
});

connect();
