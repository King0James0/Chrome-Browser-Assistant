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

  socket.addEventListener('message', async (event) => {
    let msg: WSMessage;
    try {
      msg = JSON.parse(event.data) as WSMessage;
    } catch (err) {
      console.warn('[bg] failed to parse backend message', err);
      return;
    }
    try {
      const tabs = await chrome.tabs.query({});
      let delivered = 0;
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        try {
          await chrome.tabs.sendMessage(tab.id, msg);
          delivered += 1;
        } catch {
          // tab has no content script (chrome://, etc.) — skip
        }
      }
      if (delivered === 0) {
        console.warn('[bg] no tabs received', msg.kind);
      }
    } catch (err) {
      console.warn('[bg] tab fanout failed', err);
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
  if (msg.kind === 'download-blob') {
    chrome.downloads
      .download({ url: msg.url, filename: msg.filename, saveAs: false })
      .then((id) => {
        console.log('[bg] download started', id, msg.filename);
        sendResponse({ ok: true, id });
      })
      .catch((err) => {
        console.warn('[bg] download failed', err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true;
  }
  if (socket?.readyState === WebSocket.OPEN) {
    console.log('[bg] forward', msg.kind);
    socket.send(JSON.stringify(msg));
    sendResponse({ ok: true });
  } else {
    console.warn('[bg] socket not open, dropping', msg.kind, 'state=', socket?.readyState);
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
