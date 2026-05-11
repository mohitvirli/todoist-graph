# Todoist Graph

Tiny Electron desktop app. GitHub-style contribution heatmap of your Todoist completions over the last 3 months.

## Setup

1. `npm install`
2. `npm run dev` — runs Vite + Electron
3. On first launch, paste your Todoist API token. Token stored locally via `electron-store` (no `.env` needed). Get token at https://app.todoist.com/app/settings/integrations/developer — click the **Get token →** link in the app to open it.
4. `npm run build` — packages a macOS `.dmg` via `electron-builder`

Optional: set `TODOIST_API_KEY` in a `.env` file for dev — used as fallback if no stored token.

## How it works

- **Main process** (`electron/main.js`): owns the API token (kept in `electron-store`), calls Todoist API v1 (`/api/v1/tasks/completed/by_completion_date`, up to 200 items, last 3 months, cursor-paginated), caches raw items + window bounds, exposes IPC handlers.
- **Preload** (`electron/preload.js`): `contextBridge` exposes `window.api.fetchTasks()`, `getCached()`, `getToken()`, `setToken()`, `clearToken()`, `getTheme()`, `closeWindow()`, `openExternal()`, focus/theme listeners.
- **Renderer** (`src/`): vanilla JS. First-run shows setup view to enter token; otherwise boots from cache instantly, then refreshes in background. Re-fetches on window focus + every 15 min. Manual refresh button with spin. Gear icon reopens setup to update or clear token.
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

## Security

API token never reaches the renderer process. All Todoist HTTP calls live in main; renderer talks only via IPC (`contextBridge`, `contextIsolation: true`, no `nodeIntegration`).
