# Windows Setup

> Tested on Windows 10/11. Linux/macOS support TBD.

## Prerequisites

- **Node.js 20+** — verify with `node --version`. Get it from [nodejs.org](https://nodejs.org/).
- **Chrome** — latest stable.
- **Git** — for cloning. Optional if you download a release zip.
- **An LLM endpoint** you can reach. Anything works:
  - A local Ollama install (`ollama serve` on `http://localhost:11434`)
  - A local LM Studio
  - A self-hosted vLLM
  - An OpenAI / Anthropic / OpenRouter API key

## Install

```bash
git clone https://github.com/King0James0/Chrome-Browser-Assistant.git
cd Chrome-Browser-Assistant
npm install
npx playwright install chromium    # ~150 MB; needed for Mode B (headless)
cp .env.example .env
```

Edit `.env` and fill in:
- `DEFAULT_MODEL` — the model id you want as the default
- The provider URL or API key for whichever LLM(s) you'll use

## Run

```bash
npm run dev
```

Starts both the backend and the model router. Logs in the console. `Ctrl+C` to stop.

## Load the extension into Chrome

1. Build the extension: `npm run build:extension` (creates `extension/dist/`)
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select `extension/dist/`
5. The bubble should appear on the next page you load. If it doesn't, refresh.

## Configure Chrome for Mode A

Mode A (drive your real browser) requires Chrome to be launched with a remote debugging port. See [`chrome-launch.md`](chrome-launch.md) for the wrapper shortcut and what to watch out for.

## First-run config

Right-click the extension's toolbar icon → **Options** (or click the gear in the bubble):
- Pick a default model
- Upload a custom avatar (or pick from the bundled set)
- Set hotkeys (default: `Alt+Shift+A` to summon/dismiss)

## Run as a Windows service (optional)

For day-to-day use you'll want the backend to start on login. Recommended: NSSM (Non-Sucking Service Manager). Walk-through to be added; for now, run `npm run dev` from a terminal that stays open.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bubble doesn't appear | Page is `chrome://*` or extension not loaded | Reload tab. Extensions can't run on Chrome internal pages. |
| "Backend disconnected" badge | `npm run dev` not running | Start backend; check console for errors. |
| Model picker empty | `.env` has no provider configured | Edit `.env`, restart backend. |
| Mode A fails | Chrome wasn't launched with debug flag | See [`chrome-launch.md`](chrome-launch.md). |
| Mode B fails to launch | Playwright Chromium not installed | `npx playwright install chromium` |
