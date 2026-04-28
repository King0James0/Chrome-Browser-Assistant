# Architecture

Chrome-Browser-Assistant has three components, all running on your local machine:

1. **Extension** — Chrome MV3, runs inside your browser. The visible part: floating overlay, content-script page reader, settings UI.
2. **Backend** — Node 20+ service. The brain: agent loop, conversation store, Playwright control, tool execution.
3. **Model router** — A submodule of the backend. Translates a unified internal request into whichever LLM provider you've configured.

Everything talks over `localhost`. Nothing is exposed to your LAN.

## Component diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Your Chrome browser                                                │
│                                                                     │
│  ┌─────────────────┐                                                │
│  │ Extension       │                                                │
│  │  ├─ overlay     │ Shadow-DOM-isolated floating bubble per tab    │
│  │  ├─ content     │ DOM reader, click bridge                       │
│  │  ├─ background  │ MV3 service worker, WebSocket client           │
│  │  └─ settings    │ Model picker, avatar upload, hotkeys           │
│  └────────┬────────┘                                                │
│           │  WebSocket                                              │
└───────────┼─────────────────────────────────────────────────────────┘
            │
   ┌────────▼─────────────────────────────────────────────────┐
   │  Backend  (localhost:BACKEND_PORT)                       │
   │  ┌──────────────┐  ┌────────────┐  ┌─────────────────┐  │
   │  │ WS server    │  │ Agent loop │  │ Tool dispatcher │  │
   │  └──────────────┘  └─────┬──────┘  └────────┬────────┘  │
   │  ┌──────────────┐        │                  │           │
   │  │ SQLite hist. │        │       ┌──────────▼─────────┐ │
   │  └──────────────┘        │       │ Playwright control │ │
   │                          │       │  Mode A: CDP       │ │
   │              ┌───────────▼──┐    │  Mode B: headless  │ │
   │              │ Model router │    └────────────────────┘ │
   │              └───────┬──────┘                           │
   └──────────────────────┼──────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │  Your LLM endpoints     │
            │  (Ollama, vLLM, OpenAI, │
            │  Anthropic, OpenRouter, │
            │  LM Studio, ...)        │
            └─────────────────────────┘
```

## Component responsibilities

### Extension
- Render floating overlay in a Shadow DOM root injected into every page (CSS isolation from the host page)
- Read page content (text, structured outline, optional full HTML)
- Forward user input to backend via WebSocket
- Stream backend responses into the overlay chat
- Persist UI state (avatar, position, model preference) in `chrome.storage.local`
- Expose a slash-command surface (`/clear`, `/model`, `/save`, ...)

### Backend
- Accept WebSocket connections from the extension
- Run the agent loop (model call → tool call → tool result → repeat → final answer)
- Dispatch tool calls to either:
  - **Mode A** — a Playwright page object connected to the user's real Chrome via CDP at `:9222`
  - **Mode B** — a Playwright page object in a headless bundled Chromium
- Stream LLM tokens and tool results back to the extension
- Persist chat history to SQLite (per-session keys)

### Model router
- Single entry point: `POST /v1/chat/completions` (OpenAI-compatible)
- Routes by model id to a configured provider
- Provider adapters:
  - **OpenAI-compatible** — covers Ollama, vLLM, OpenAI, OpenRouter, LM Studio, Together, Fireworks, anything that speaks OpenAI Chat Completions
  - **Anthropic** — small shim translating between OpenAI and Anthropic Messages format
- Streams via SSE
- Future: fallback chains, response caching, budget tracking

## Data flow: "ask about this page"

```
1. User clicks bubble → types question
2. Extension content script reads page (DOM text + structured outline)
3. Extension sends {message, page_context, model_id} to backend over WS
4. Backend appends to history, calls router with context-stuffed prompt
5. Router forwards to provider
6. Tokens stream back: provider → router → backend → extension → bubble
7. Final message persisted to SQLite
```

Pure read-and-summarize, no tool execution.

## Data flow: "drive my browser" (Mode A)

```
1. User: "click the 'Subscribe' button"
2. Extension forwards request + active-tab metadata to backend
3. Backend calls model with a system prompt listing v1 tools
4. Model returns a tool call: { tool: "click", args: { selector: "button.subscribe" } }
5. Tool dispatcher → Playwright (connected via CDP to your real Chrome at :9222)
6. Playwright clicks the button on your actual tab
7. Tool result (success/error) returns to model
8. Loop continues until model returns plain text (final answer)
9. Final answer streams back to bubble
```

## Data flow: "go research X" (Mode B)

```
1. User: "/research <topic>, write 1000 words"
2. Backend spawns a headless Chromium via Playwright
3. Agent loop runs in that browser: navigate → read → click → extract
4. Progress streams to bubble (partial)
5. On completion, final summary is written to ./data/research/<timestamp>.md
6. File path returned to extension for display
```

## Tool layer (v1)

All tools take a Playwright `Page` object as input — same code path for Mode A and Mode B.

| Tool | Description |
|---|---|
| `click` | Click an element by CSS selector or visible text |
| `type` | Type into a focused input |
| `scroll` | Scroll page or element by px / to selector |
| `get_text` | Return visible text under selector (defaults to body) |
| `get_html` | Return raw HTML under selector |
| `navigate` | Go to URL in the current tab |
| `wait_for_selector` | Block until selector appears (timeout configurable) |
| `screenshot` | Return PNG bytes of viewport or element |

Each tool has a JSON schema exposed to the LLM via OpenAI-style function calling.

## State persistence

- **Chat history** — SQLite at `${DATA_DIR}/history.sqlite`
- **Avatars and settings** — `chrome.storage.local` + `${DATA_DIR}/avatars/`
- **Research artifacts** — `${DATA_DIR}/research/<timestamp>.md`

## What's deliberately NOT in v1

- DevTools panel access via `chrome.debugger` (the "yellow bar") — beyond Phase 2
- Cross-session RAG over visited pages — beyond Phase 2
- Multi-tab orchestration — beyond Phase 2
- Vision-based clicking fallback for sites that block synthetic events — beyond Phase 2

See [`roadmap.md`](roadmap.md) for the full phase breakdown.

## Phase 2: companion workspace builder (planned)

Phase 2 integrates with [agent0ai/space-agent](https://github.com/agent0ai/space-agent), a self-hosted natural-language workspace platform. The two tools stay independent — the extension overlays your browser, space-agent runs as its own service in its own tab — but a `/build` slash command in the extension hands off page context so the workspace builder can use what you were looking at as source material.

### Bridge: extension → space-agent

```
1. User in extension chat: "/build me a dashboard for the metrics on this page"
2. Extension serializes context: { url, title, selected_text, structured_outline, model_id }
3. Extension opens new tab to:
     https://<space-agent-host>/#/spaces?seed=<base64 JSON>
4. Frontend "intake" module on space-agent's app/ layer reads the URL hash,
   plants a seeded chat message, triggers the normal browser-side build agent
5. User watches the workspace get built in the new tab
```

### Why this approach

Space-agent's `server/AGENTS.md` is explicit: the agent runs entirely in the browser, the server is just file/auth/Git substrate, and backend changes are exceptional. This rules out a `POST /api/build` endpoint approach. The URL-hash + frontend-intake-module pattern uses only space-agent's public, documented `app/L2/<user>/` extension surface and piggybacks on the user's existing `space_session` cookie for auth. No fork of space-agent's server.

### Reverse direction (Bridge 2)

Eventually space-agent skills may need to scrape live sites to populate workspaces. Space-agent's browser-side agent already makes outbound HTTP calls (including via `/api/proxy`), so it can call our backend's Playwright pool just like any other HTTP service. No special integration code needed on either side.
