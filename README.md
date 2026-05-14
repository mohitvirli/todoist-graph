# Todoist Graph

Tiny Electron desktop app. GitHub-style contribution heatmap of your visible Todoist completion history.

## Demo
<img width="642" height="332" alt="image" src="https://github.com/user-attachments/assets/23b5148f-838c-4f33-88da-46f91ab1c8d5" />
<img width="642" height="332" alt="image" src="https://github.com/user-attachments/assets/651940bc-3dfd-48fe-b673-25ca9674746a" />

## Features

- **At-a-glance heatmap** of completed Todoist tasks for the full visible graph range.
- **Cache-first render** — graph paints from local cache instantly, then fetches when the visible range needs data. No loading spinner on launch.
- **Auto-refresh** on window focus, every 15 minutes, and on demand via the refresh button.
- **Themes** — System, GitHub Light/Dark, Claude Light/Dark, and the full Todoist palette (Todoist Light/Dark plus Tangerine Tango, Moonstone, Kale, Lavender, Raspberry Ripple, Bubblegum, Sunset, Bordeaux, Teal Tide, Pacific Sky).
- **Zoom** (80%–200%) and optional **month / day-of-week labels**.
- **Tooltip** on cell hover with date, count, and up to 4 task names.
- **Stats row** — total completed, current streak, best day, active days (optional; can be hidden in Settings).
- **Responsive reflow** — drag to resize; cells stay fixed at 11px, weeks add/drop based on width.
- **Frameless window** with a custom drag region. Bounds, theme, zoom, labels, and stats-row visibility all persist across launches.
- **Token stays in the main process** — never reaches the renderer.

## Install (for users)

1. Grab the latest `.dmg` from [Releases](https://github.com/mohitvirli/todoist-graph/releases) — `arm64` for Apple Silicon, `x64` for Intel.
2. Open the `.dmg`, drag **Todoist Graph** to `/Applications`.
3. First launch: macOS will block the unsigned app. Right-click → **Open**, then **Open** again. (Or run once: `xattr -dr com.apple.quarantine "/Applications/Todoist Graph.app"`.)
4. The Settings panel opens automatically on first run. Paste your Todoist API token and hit Save.
   - Click **Get token →** to open Todoist's developer page in your browser.
   - Direct link: <https://app.todoist.com/app/settings/integrations/developer>

To update: download the newer `.dmg`, drag-replace in `/Applications`. Settings persist at `~/Library/Application Support/todoist-graph/`.

## Settings

Open via the gear icon (top-right). Closes via the same icon.

| Setting | What it does |
|---------|--------------|
| **Todoist API token** | Personal token. Verified against Todoist on save. Stored locally only. |
| **Theme** | Pick from System / GitHub / Claude / Todoist palettes. Applies live. Autosaved. |
| **Show month and day labels** | Toggles labels around the heatmap (Jan / Feb / …, Mon / Wed / Fri). Autosaved. |
| **Show stats row** | Toggles the line under the graph (totals, streak, best day, active days). Autosaved. |
| **Default zoom** | 80%–200% slider. Applies live. Autosaved. |

Display settings autosave on change — no need to click Save unless you're changing the token.

## Color scale

| Tasks | Cell |
|-------|------|
| 0     | muted |
| 1     | lightest |
| 2–3   | mid |
| 4–7   | strong |
| 8+    | brightest |

The exact hues come from the active theme.

## How it works

- **Main process** (`electron/main.js`): owns the API token (kept in `electron-store`), calls Todoist API v1 (`/api/v1/tasks/completed/by_completion_date`, cursor-paginated with `limit=200`, chunked into Todoist's 3-month completion-date windows, rate-limit-aware with 429 backoff), caches raw items + fetched range + window bounds + UI settings (theme, zoom, labels, stats row), exposes IPC handlers.
- **Preload** (`electron/preload.js`): `contextBridge` exposes `window.api.fetchTasks()`, `getCached()`, `getToken()`, `setToken()`, `clearToken()`, `getSettings()`, `setSettings()`, `setZoom()`, `getTheme()`, `openExternal()`, plus focus and theme listeners.
- **Renderer** (`src/`): vanilla JS — no framework. First-run shows the Settings view to enter a token; otherwise boots from cache instantly, then requests fresh data for the visible range as needed.
- **Reflow**: graph computes the visible date range from `maxWeeks = floor((width + gap) / weekWidth)`; `resize` re-renders so cells stay fixed (11px), the column count adapts, and cache refreshes when the new visible range is not covered.
- **Security**: `contextIsolation: true`, no `nodeIntegration`. The token never reaches the renderer — all Todoist HTTP calls live in main.

## Develop

Requirements: Node 18+, macOS (for `.dmg` packaging).

```sh
npm install
npm run dev           # Vite renderer + Electron
```

Optional: set `TODOIST_API_KEY` in a `.env` for dev — used as a fallback if no stored token exists.

Project layout:

```
todoist-graph/
├── electron/
│   ├── main.js        # Electron main process — IPC, Todoist HTTP, store
│   └── preload.js     # contextBridge bridge to renderer
└── src/
    ├── index.html
    ├── main.js        # renderer entry — boots, wires events
    ├── graph.js       # heatmap rendering + reflow
    └── style.css      # theme variables + layout
```

## Release (for maintainers)

Requires the `gh` CLI authenticated and Apple Silicon + Intel build capability (any Mac).

```sh
npm version patch          # bump + git tag
npm run release            # build dmg + create GitHub Release
git push --follow-tags
```

`npm run release` runs:
- `vite build` → renderer into `dist/`
- `electron-builder --mac dmg --arm64 --x64` → `.dmg` artifacts in `dist-electron/`
- `gh release create vX.Y.Z …` with release body taken from the matching `## [X.Y.Z]` section in `CHANGELOG.md` (`scripts/write-release-notes.js`)

The app is unsigned. If you ever obtain an Apple Developer cert, add `CSC_LINK` / `CSC_KEY_PASSWORD` and a `notarize` config — users stop seeing the Gatekeeper prompt.

## Window

Frameless, 720×300 default, min 400×220, resizable. Drag from the top 28px strip. Bounds, theme, zoom, labels, and stats-row visibility persist. Dock icon hidden on macOS — no tray.

## License

MIT.
