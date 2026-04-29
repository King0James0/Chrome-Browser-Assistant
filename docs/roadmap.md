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

## Phase 1b — Mode B headless + tool surface upgrade ◯

Background research without taking over your real browser, and a wider tool set so the agent can do more in fewer round-trips.

**Mode B (headless):**
- Headless Chromium pool managed by the backend
- `/research` slash command that hands a topic + brief to a parallel agent loop
- Streaming progress to the bubble while it works
- Research artifacts persisted to `${DATA_DIR}/research/<timestamp>.md`
- Multiple concurrent headless tasks

**Tool surface upgrade (applies to both Mode A and Mode B):**
- `snapshot` — accessibility-tree dump with stable element refs (`@0-5` style). Default observation primitive in place of screenshot for most flows; saves vision tokens and eliminates hallucinated selectors. `click` accepts refs from snapshot in addition to selectors.
- `is_visible <selector>` — boolean predicate, cheap pre-check before action
- `is_checked <selector>` — boolean predicate for checkboxes / radio
- `wait load|selector|timeout` — explicit synchronization (page load event / selector appearance / fixed sleep)
- `fill <selector> <value>` — locate, clear, set value, optional Enter; idempotent. Higher-level than `type` (which still exists for focus-typed input).
- Tab management: `pages` (list open tabs), `tab_switch <index>`, `tab_close [index]` — handles `target=_blank`, OAuth popups, and link-fan-out flows that the single-current-tab heuristic can't follow.

## Phase 1c — Polish + production launch path ◯

The day-to-day affordances that make it pleasant to actually use, plus the work needed before non-developer users can install this.

**Polish:**
- Right-click context menu ("Ask the agent about this"; "Send to space-agent" once Phase 2 lands)
- Configurable keyboard shortcut to summon/dismiss the bubble
- Per-domain model preferences (e.g. frontier model on news sites, fast local model on dev docs)
- Position persistence per tab and across sessions
- NSSM-based Windows service so the backend starts on login and survives reboots
- Preserve the page-level highlight visually when the chat input takes focus (today the agent receives the selection correctly via the `selectionchange` listener, but the visible highlight on the page disappears the moment the input is focused — browser default). Likely approach: intercept `mousedown` on the input, `preventDefault()`, focus programmatically, optionally restore the selection range on input blur.

**Production launch path:**
- `chrome.debugger` transport as the default Mode A path so users don't need to launch Chrome with `--remote-debugging-port` or maintain an isolated profile. Existing Playwright-over-CDP path stays as an opt-in "power user" mode for those who want zero yellow bar and full Playwright surface.
- MV3 service-worker lifecycle hardening beyond the chrome.alarms keepalive — investigate `chrome.runtime.onConnect` long-poll + WS health checks for fully reliable cross-suspension behavior.

## Phase 1d — Multimodal chat input ◯

Expand how the user talks to the agent — beyond plain typed text.

- **Capture button** in the chat panel: opens a region-select overlay on the page; user drags to select a rectangle; captured PNG is inserted into the chat as an attachment so the user can ask the agent about that specific area. Different from the existing `screenshot` tool: that one is *agent*-initiated; this one is *user*-initiated.
- **Attach-file button**: standard file picker; supported types include text/code/markdown (inlined), PDF (parsed text + optional vision), images (sent multimodal), and small CSVs. Per-file size cap so the chat history doesn't blow up. Attachments persist with the chat in SQLite.
- **Audio input button**: hold-to-talk or press-to-start/stop microphone capture via `getUserMedia` + `MediaRecorder`. Default path: local STT (e.g. Whisper.cpp on the backend) → transcribed text becomes the prompt, with a visible transcript edit step before send. Power-user path (later): direct audio to a multimodal-audio model when one is wired into the router.

Shared infrastructure required: multimodal-aware model routing in the backend (vision and/or audio capability flags per registered model), an `attachments[]` field on `chat-request` WSMessage, attachment storage with a stable handle/URL, and chat-panel UI for the three buttons + inline previews.

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
