# Extension

Chrome MV3 extension. Floating overlay, content-script page reader, settings UI.

## Build

```bash
cd extension
npm install
npm run build
```

Output goes to `dist/`. Load `dist/` as an unpacked extension via `chrome://extensions` (Developer mode → Load unpacked).

## Dev mode

```bash
npm run dev
```

Vite + `@crxjs/vite-plugin` serves with HMR. The extension auto-reloads on source changes after the initial unpacked load.

## Structure

- `src/manifest.ts` — MV3 manifest as TypeScript (consumed by `@crxjs/vite-plugin`)
- `src/background/` — service worker; manages the WebSocket to the backend, dispatches messages to/from content scripts
- `src/content/` — content-script entry; injects an overlay host into every page using a Shadow DOM root
- `src/overlay/` — React app rendered inside the Shadow DOM (real UI lands in a later task)
- `src/settings/` — options page (`chrome://extensions` → extension Options)
- `src/shared/` — types and storage helpers shared across entries
- `public/avatars/` — bundled built-in SVG characters

## TODO before public release

- Replace the placeholder overlay component (`src/overlay/App.tsx`) with the real draggable bubble
- Add real PNG icons in `public/icons/` (16, 32, 48, 128 px) and wire them into `manifest.ts`
- Build out the settings UI in `src/settings/App.tsx`
