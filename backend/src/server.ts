import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { handleChatRequest, type SessionState } from './agent/handle-chat';
import { config } from './config';
import { HistoryStore } from './history/store';
import { buildRouterFromConfig } from './router';
import type { ChatRequest } from './router/types';
import { createWSServer } from './ws/server';

async function main() {
  const router = buildRouterFromConfig();
  const history = new HistoryStore(config.dataDir);
  const sessions = new Map<string, SessionState>();

  console.log(
    `[router] models registered: ${router.list().map((m) => m.modelId).join(', ') || '(none)'}`,
  );

  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      ok: true,
      models: router.list().map((m) => m.modelId),
    }),
  );

  app.get('/v1/models', (c) =>
    c.json({
      object: 'list',
      data: router.list().map((m) => ({ id: m.modelId, object: 'model', provider: m.provider })),
    }),
  );

  app.post('/v1/chat/completions', async (c) => {
    const body = (await c.req.json()) as ChatRequest;
    return streamSSE(c, async (stream) => {
      for await (const chunk of router.chat(body)) {
        await stream.writeSSE({ data: JSON.stringify(chunk) });
      }
      await stream.writeSSE({ data: '[DONE]' });
    });
  });

  serve({
    fetch: app.fetch,
    hostname: config.backendHost,
    port: config.routerPort,
  });
  console.log(`[router] listening http://${config.backendHost}:${config.routerPort}`);

  createWSServer(config.backendHost, config.backendPort, {
    onConnect: (id) => {
      console.log(`[ws] client ${id} connected`);
      sessions.set(id, { history: [] });
    },
    onDisconnect: (id) => {
      console.log(`[ws] client ${id} disconnected`);
      sessions.delete(id);
    },
    onMessage: async (clientId, msg, send) => {
      if (msg.kind === 'chat-request') {
        const state = sessions.get(clientId) ?? { history: [] };
        sessions.set(clientId, state);
        await handleChatRequest(msg, state, router, send);
      }
    },
  });
  console.log(`[ws] listening ws://${config.backendHost}:${config.backendPort}`);

  process.on('SIGINT', () => {
    history.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('fatal', err);
  process.exit(1);
});
