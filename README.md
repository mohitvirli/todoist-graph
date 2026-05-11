# Todoist Graph

Tiny Electron desktop app. GitHub-style contribution heatmap of your Todoist completions over the last 3 months.

## Setup

1. `npm install`
2. Create `.env` with `TODOIST_API_KEY=your_token` — get token at https://app.todoist.com/app/settings/integrations/developer
3. `npm run dev` — runs Vite + Electron
4. `npm run build` — packages a macOS `.dmg` via `electron-builder`

## How it works

- **Main process** (`electron/main.js`): owns the API token, calls Todoist Sync API (`/sync/v9/completed/get_all`, up to 200 items, last 3 months), caches raw items + window bounds in `electron-store`, exposes IPC handlers.
- **Preload** (`electron/preload.js`): `contextBridge` exposes `window.api.fetchTasks()`, `getCached()`, `getTheme()`, `closeWindow()`, focus/theme listeners.
- **Renderer** (`src/`): vanilla JS. Boots from cache instantly, then refreshes in background. Re-fetches on window focus + every 15 min. Manual refresh button with spin.
- **Reflow**: graph computes `maxWeeks = floor((width + gap) / weekWidth)` on every render; `resize` re-renders so cells stay fixed (11px) and the column count adapts.

## Color scale

| Tasks | Class |
|-------|-------|
| 0     | muted gray |
| 1     | light teal |
| 2–3   | mid teal |
| 4–7   | strong teal |
| 8+    | darkest teal |

## Window

Frameless, 720×300 default, min 400×220, resizable, drag via top 28px strip, ✕ closes. Bounds persisted. Dark/light follows system. Dock icon hidden on macOS.
