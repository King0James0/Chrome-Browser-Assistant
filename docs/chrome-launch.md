# Launching Chrome for Mode A

Mode A — where the agent drives the same Chrome window you're using — requires Chrome to be started with a remote debugging port open. This page explains how, why, and what to watch out for.

## Why this is needed

Chrome's automation surface (Chrome DevTools Protocol, "CDP") is gated behind the `--remote-debugging-port` flag. Without it, no external program can attach to your browser. With it, anything on `localhost:9222` can drive your tabs.

Because the port binds to `127.0.0.1` only and the backend runs on the same machine, this is local-only — it does NOT expose your browser to the LAN.

## The launch command

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
```

That `--user-data-dir` is the path to your **real Chrome profile**, so all your bookmarks, saved logins, extensions, and history are intact. The agent will see what you see, including your wallet extensions and authenticated sessions.

If your Chrome is installed somewhere else, adjust the path. Common alternatives:
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe` (older 32-bit installs)
- `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe` (per-user installs)

If you'd rather isolate the agent from your main profile, point `--user-data-dir` to a fresh folder:

```
--user-data-dir="%LOCALAPPDATA%\Google\Chrome\AgentProfile"
```

That creates a clean profile on first launch. You'll need to re-log into anything you want the agent to access.

## Make it the default Chrome launch path

The cleanest setup: replace whatever Chrome shortcut you use day-to-day with one that includes the debug flag.

1. Right-click the desktop → **New** → **Shortcut**
2. Set the target to:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
3. Name it something like `Chrome (Agent)`
4. Right-click → **Properties** → **Change Icon** → browse to `chrome.exe` and pick the standard icon
5. Right-click → **Pin to taskbar**
6. Unpin the old Chrome shortcut

Drop the same shortcut in `shell:startup` if you want it on login.

## Important: kill existing Chrome processes first

Chrome refuses to attach the debugger if it's already running with the same `--user-data-dir`. If you click the new shortcut while Chrome was already running, the new instance will just open a tab in the existing process — without the debug port.

To recover:

```
taskkill /IM chrome.exe /F
```

Then relaunch via the shortcut.

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
| `connection refused` on `:9222` | Chrome not launched with the flag | Close Chrome, relaunch via shortcut |
| Mode A connects but tabs are empty | Wrong `--user-data-dir` (a fresh profile) | Edit shortcut to point at your real profile path |
| Agent click visible but nothing happens | Some sites block synthetic events | Phase 2 will add CDP-trusted clicks via `Input.dispatchMouseEvent` |
| Two Chromes running with mismatched profiles | Mixed shortcut + manual launch | Close all `chrome.exe` instances, relaunch via shortcut only |
