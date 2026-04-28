# Claude Code Project Instructions

## Project

Chrome-Browser-Assistant — a Chrome MV3 extension + local Node backend + model router that overlays an LLM-powered agent on every browser page. The agent can read pages, answer questions about them, and (optionally) drive the browser to click and navigate on the user's behalf.

## Tech Stack

- **Extension:** TypeScript + React + Vite (Manifest V3)
- **Backend:** Node 20+ (TypeScript)
- **Browser automation:** Playwright — `connectOverCDP` for the user's real Chrome (Mode A); bundled headless Chromium for background tasks (Mode B)
- **Storage:** SQLite (`better-sqlite3`) for chat history
- **Model router:** Node-native, OpenAI-compatible front-end with adapters for Anthropic and other providers
- **Package manager:** npm

## Workflow

- Never auto-commit. Always ask before creating any git commits.
- Run tests after changes (when tests exist).
- Scaffold one component at a time and check in before moving on.
- Prefer editing existing files over creating new ones.

## Code Style

- No emojis in code or responses.
- No comments unless the WHY is non-obvious or behavior would surprise a reader.
- TypeScript strict mode in both extension and backend.
- Avoid over-engineering — minimum complexity needed for the task.

## Shell

- Windows host. Use bash-compatible syntax (forward slashes, Unix-style commands) where possible.

## Status

Pre-alpha. Phase 1a (Mode A end-to-end) in progress. See [`docs/roadmap.md`](docs/roadmap.md) for the full phase breakdown.
