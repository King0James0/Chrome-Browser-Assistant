# Chrome-Browser-Assistant

An LLM-powered agent that lives in your browser. Drag the floating overlay anywhere on the page, ask it about what you're looking at, or have it click and navigate on your behalf. Bring your own model — any OpenAI-compatible endpoint (Ollama, vLLM, OpenAI, OpenRouter, LM Studio, Together, Fireworks, etc.) plus Anthropic.

> **Status:** pre-alpha, in active development. Things will break.

## What it does

- **Overlay on every page.** A draggable bubble (with a custom avatar of your choice) lives above any tab. Click to chat about what you're looking at; drag to a corner to dock out of the way.
- **Drives your real browser.** Optional: launch Chrome with a remote debugging port and the agent can click, type, scroll, and navigate on your behalf — using *your* logins, *your* sessions, *your* extensions.
- **Background research.** Optional headless mode: hand the agent a research task and it runs in a separate hidden browser, returning a summary when done.
- **Bring your own model.** Local-first, but supports any OpenAI-compatible endpoint plus Anthropic. Pick per-task or set a default.

## Architecture

Three components, all on your machine:

- **Extension** — Chrome MV3, TypeScript + React + Vite. Floating overlay, content-script page reader, settings UI.
- **Backend** — Node 20+, TypeScript. Drives Playwright, manages chat history (SQLite), exposes a WebSocket to the extension.
- **Model router** — Node-native module inside the backend. OpenAI-compatible front, dispatches to whatever provider you've configured.

```
Chrome <──> Extension <──WS──> Backend <──> Model Router <──> Your LLMs
                                  │
                                  └──> Playwright
                                         ├── Mode A: your real Chrome (CDP)
                                         └── Mode B: bundled headless Chromium
```

## Requirements

- Windows 10/11 (Linux/macOS support TBD)
- Node 20+
- Chrome (latest stable)
- An LLM endpoint you can reach

## Setup

See [`docs/setup-windows.md`](docs/setup-windows.md) for the full walk-through.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md) for the full phase breakdown. Currently in **Phase 1a** (Mode A end-to-end).

## License

MIT — see [`LICENSE`](LICENSE).
