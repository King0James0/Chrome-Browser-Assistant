# Backend

Local Node service that:

- Bridges the Chrome extension to your LLM endpoints
- Drives Playwright in either Mode A (your real Chrome) or Mode B (headless)
- Persists chat history (SQLite)
- Hosts a local OpenAI-compatible model router at `/v1/chat/completions`

## Build

```bash
cd backend
npm install
npx playwright install chromium    # only needed for Mode B
cp ../.env.example .env
npm run dev
```

## Endpoints (model router)

- `GET  /health`              → `{ "ok": true }`
- `GET  /v1/models`           → list of registered models
- `POST /v1/chat/completions` → SSE stream of `ChatChunk`s (OpenAI-compatible front)

## WebSocket

`ws://127.0.0.1:${BACKEND_PORT}/ws` — extension connects here for chat I/O and tool dispatch.

## Structure

- `src/server.ts` — entry; starts both HTTP router and the WebSocket server
- `src/config.ts` — env loading (ports, data dir, provider URLs and keys)
- `src/ws/server.ts` — minimal WebSocket server with message dispatch
- `src/router/` — Node-native model router (OpenAI-compatible adapter + Anthropic shim)
- `src/playwright/mode-a.ts` — `connectOverCDP` to your real Chrome (skeleton)
- `src/playwright/mode-b.ts` — headless Chromium spawner (skeleton)
- `src/agent/loop.ts` — agent loop scaffold
- `src/tools/index.ts` — v1 tool schemas (real dispatch lives in task #6)
- `src/history/store.ts` — SQLite chat history (better-sqlite3)
- `src/shared/types.ts` — message types (mirror of `extension/src/shared/types.ts`)

## TODO

- Wire real tool dispatch to Playwright pages (task #6)
- Implement Mode A flow connecting extension messages to the agent loop (task #7)
- Add model registration via config file / settings UI (task #8)
