# Launching Chrome for Mode A

Mode A — where the agent drives the same Chrome window you're using — requires Chrome to be started with a remote debugging port open. This page explains how, why, and what to watch out for.

## Why this is needed

Chrome's automation surface (Chrome DevTools Protocol, "CDP") is gated behind the `--remote-debugging-port` flag. Without it, no external program can attach to your browser. With it, anything on `localhost:9222` can drive your tabs.

Because the port binds to `127.0.0.1` only and the backend runs on the same machine, this is local-only — it does NOT expose your browser to the LAN.

## The recommended path: launcher script

Use [`scripts/launch-chrome-agent.cmd`](../scripts/launch-chrome-agent.cmd) — it locates Chrome (64-bit, per-user, or 32-bit), then starts it with the debug port and an **isolated** `AgentProfile` so it doesn't conflict with your day-to-day Chrome.

To make it convenient:
1. Right-click the desktop → **New** → **Shortcut**
2. Set the target to the full path of the script, e.g.:
   ```
   D:\path\to\Chrome-Browser-Assistant\scripts\launch-chrome-agent.cmd
   ```
3. Name it something like `Chrome (Agent)`
4. Optionally → **Properties** → **Change Icon** → browse to `chrome.exe` and pick the standard icon
5. Optionally pin to taskbar; drop into `shell:startup` if you want it on login

A console window flashes briefly on launch — that's the script. Chrome opens on a clean `AgentProfile` and listens on `127.0.0.1:9222`.

The first time the AgentProfile launches you'll need to install the Chrome-Browser-Assistant extension into it (`chrome://extensions` → Developer mode → Load unpacked) and re-sign-in to anything the agent needs to see.

## Why an isolated profile (Chrome 136+ note)

Earlier docs suggested launching against your **default** Chrome profile. Don't — Chrome 136+ silently drops `--remote-debugging-port` if the default profile is already in use anywhere on the machine. The flag appears to take effect, the new shortcut just opens a tab in your existing Chrome, and `:9222` never opens. The launcher avoids this trap by using a separate `--user-data-dir`.

If you'd rather attach to your real profile (and accept the security trade-off + the requirement to fully close every Chrome instance first), the manual command is:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
```

Run from cmd / PowerShell. Make sure `taskkill /IM chrome.exe /F` first or the flag will be ignored.

## Verifying the port is open

```bash
curl http://localhost:9222/json/version
```

If you get JSON back with a `webSocketDebuggerUrl` field, you're good. If `connection refused`, Chrome isn't running with the flag.

## Security notes

- The debug port is bound to `127.0.0.1` and is **not** reachable from your LAN.
- Anything running locally as your user can drive your browser via `:9222`. If you have other tools on this machine you don't trust, either use a separate profile (above) or close the agent shortcut and use plain Chrome.
- Browser extensions installed in your real profile can still see traffic regardless of this setup. The agent doesn't change that calculus.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `connection refused` on `:9222` | Chrome not launched with the flag, or merged into your default-profile Chrome | Use the launcher script (it uses an isolated profile so this can't happen) |
| Console window flashes but no Chrome appears | Wrapper script error (rare — usually a Chrome path mismatch) | Run the script from an open cmd window: `cmd /k <full path to launch-chrome-agent.cmd>` and read the error |
| Mode A connects but the agent can't see your logins | AgentProfile is isolated by design | Sign in inside the AgentProfile Chrome window, or use the manual real-profile command (see above) |
| Agent click visible but nothing happens | Some sites block synthetic events | Phase 2 will add CDP-trusted clicks via `Input.dispatchMouseEvent` |
| Two Chromes running with mismatched profiles | Mixed shortcut + manual launch | Close all `chrome.exe` instances, relaunch via the launcher script |
