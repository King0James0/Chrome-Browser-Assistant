import { WebSocketServer, type WebSocket } from 'ws';
import type { WSMessage } from '../shared/types';

export interface WSHandler {
  onMessage: (
    clientId: string,
    msg: WSMessage,
    send: (reply: WSMessage) => void,
  ) => void | Promise<void>;
  onConnect?: (clientId: string) => void;
  onDisconnect?: (clientId: string) => void;
}

export function createWSServer(host: string, port: number, handler: WSHandler): WebSocketServer {
  const wss = new WebSocketServer({ host, port });
  let nextId = 1;

  wss.on('connection', (ws: WebSocket) => {
    const clientId = String(nextId++);
    handler.onConnect?.(clientId);

    ws.on('message', async (data) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString()) as WSMessage;
      } catch (err) {
        const errMsg: WSMessage = { kind: 'error', message: `bad json: ${String(err)}` };
        ws.send(JSON.stringify(errMsg));
        return;
      }
      const send = (reply: WSMessage) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(reply));
      };
      try {
        await handler.onMessage(clientId, msg, send);
      } catch (err) {
        send({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    });

    ws.on('close', () => handler.onDisconnect?.(clientId));
  });

  return wss;
}
