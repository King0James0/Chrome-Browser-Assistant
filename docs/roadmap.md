# Roadmap

Status legend: ▶ in progress · ◯ planned · ✓ shipped

## Phase 1a — Mode A end-to-end ▶

The minimum viable assistant: floating overlay on every page, talks to whichever LLM you've configured, drives your real Chrome on demand.

- Repo scaffold (top-level files, docs)
- Chrome MV3 extension skeleton (TS + React + Vite)
- Floating astronaut overlay (drag, edge-snap, custom avatar + 5–6 built-ins)
- Node backend with WebSocket to the extension
- Node-native model router (OpenAI-compatible adapter + Anthropic shim)
- v1 agent tool set: `click`, `type`, `scroll`, `get_text`, `get_html`, `navigate`, `wait_for_selector`, `screenshot`
- Mode A wiring: Playwright `connectOverCDP("http://localhost:9222")` to your real Chrome
- Chrome launch wrapper docs
- Settings UI (model picker, avatar selector, hotkeys)
- Basic slash commands: `/clear`, `/model`, `/save`, `/help`

## Phase 1b — Mode B headless ◯

Background research without taking over your real browser.

- Headless Chromium pool managed by the backend
- `/research` slash command that hands a topic + brief to a parallel agent loop
- Streaming progress to the bubble while it works
- Research artifacts persisted to `${DATA_DIR}/research/<timestamp>.md`
- Multiple concurrent headless tasks

## Phase 1c — Polish ◯

The day-to-day affordances that make it pleasant to actually use.

- Right-click context menu ("Ask the agent about this"; "Send to space-agent" once Phase 2 lands)
- Configurable keyboard shortcut to summon/dismiss the bubble
- Per-domain model preferences (e.g. frontier model on news sites, fast local model on dev docs)
- Position persistence per tab and across sessions
- NSSM-based Windows service so the backend starts on login and survives reboots

## Phase 2 — Companion workspace builder ◯

Optional integration with [agent0ai/space-agent](https://github.com/agent0ai/space-agent), a self-hosted "build me a dashboard / tool / workspace by describing it" platform.

The two products do different jobs and stay independent — the extension is for *"ask about and act on the page I'm reading,"* space-agent is for *"build me a tool by talking to it."* Phase 2 wires them so the extension can hand off page context to space-agent without leaving the page you're on.

- Stand up a self-hosted space-agent instance (separate process, separate port)
- `/build` slash command in the extension chat
- Small frontend "intake" module added to space-agent's `app/` layer — reads a seed payload from the URL hash (page URL, selected text, scraped facts) and plants it into the chat to kick off the build
- No fork of space-agent's backend needed — its `server/AGENTS.md` is explicit that the agent runs entirely in the browser, so the integration is pure frontend extension
- Right-click "Send to space-agent" entry point
- Future: Bridge 2 — space-agent calling back into the backend's Playwright pool to scrape sites it needs while building

## Beyond Phase 2

Ideas worth capturing, no commitment:

- DevTools panel access via `chrome.debugger` (network log, console, full JS source, trusted clicks via CDP `Input.dispatchMouseEvent`) — accepts the "Chrome is being controlled by automated test software" yellow bar on attached tabs
- Multi-tab orchestration ("watch these 5 tabs and alert me when X")
- Cross-session RAG over visited pages (semantic search of your browsing history)
- Vision-based clicking fallback for sites that block synthetic events
- Lottie / Rive animated avatars
- Linux and macOS support
