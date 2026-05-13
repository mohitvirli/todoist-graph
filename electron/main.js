const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PRELOAD = path.resolve(__dirname, 'preload.js');
console.log('[main] preload path:', PRELOAD, 'exists:', fs.existsSync(PRELOAD));

const store = new Store({
  defaults: {
    bounds: { width: 720, height: 300, x: undefined, y: undefined },
    completed: [],
    completedRange: null,
    lastFetched: 0,
    token: '',
    theme: 'system',
    zoom: 1.0,
    showLabels: true
  }
});

let mainWindow = null;
const isDev = !app.isPackaged;

/** Minimum time between Todoist HTTP calls (pagination, verify, etc.) */
const MIN_MS_BETWEEN_TODOIST_REQUESTS = 400;
/** Minimum time between completed full syncs (`fetch-tasks`) */
const MIN_MS_BETWEEN_FULL_SYNCS = 6000;

let nextTodoistAfter = 0;
let todoistRequestChain = Promise.resolve();
let lastFullSyncDone = 0;
let fullSyncInFlight = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtTodoistDate(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseRequestedRange(range) {
  if (!range || typeof range !== 'object') {
    throw new Error('Missing fetch range');
  }

  const since = new Date(range.since);
  const until = new Date(range.until);
  if (!Number.isFinite(since.getTime()) || !Number.isFinite(until.getTime())) {
    throw new Error('Invalid fetch range');
  }
  if (since >= until) {
    throw new Error('Fetch range must end after it starts');
  }

  return { since, until };
}

function addMonthsClamped(date, months) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function chunkCompletionRange(since, until) {
  const chunks = [];
  let chunkSince = new Date(since);

  while (chunkSince < until) {
    const chunkUntil = addMonthsClamped(chunkSince, 3);
    if (chunkUntil > until) chunkUntil.setTime(until.getTime());
    chunks.push({ since: new Date(chunkSince), until: new Date(chunkUntil) });
    chunkSince = chunkUntil;
  }

  return chunks;
}

function enqueueTodoistRequest(fn) {
  const run = todoistRequestChain.then(fn, fn);
  todoistRequestChain = run.catch(() => {});
  return run;
}

/**
 * Serialized Todoist GET with spacing and 429 handling.
 * @param {string} url
 * @param {string} token
 */
async function todoistGet(url, token) {
  return enqueueTodoistRequest(async () => {
    const gap = Math.max(0, nextTodoistAfter - Date.now());
    if (gap > 0) await sleep(gap);

    let res;
    let backoffMs = 1500;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status !== 429) break;
      const raw = res.headers.get('retry-after');
      const sec = raw ? parseInt(raw, 10) : NaN;
      const wait = Number.isFinite(sec) && sec > 0 ? Math.min(sec * 1000, 120000) : backoffMs;
      await sleep(wait);
      backoffMs = Math.min(backoffMs * 2, 120000);
    }

    nextTodoistAfter = Date.now() + MIN_MS_BETWEEN_TODOIST_REQUESTS;
    return res;
  });
}

function createWindow() {
  const bounds = store.get('bounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 400,
    minHeight: 220,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('preload-error', (_e, file, err) => {
    console.error('[main] preload error in', file, err);
  });
  mainWindow.webContents.on('console-message', (event) => {
    console.log('[renderer]', event.message);
  });

  const saveBounds = () => {
    if (!mainWindow) return;
    store.set('bounds', mainWindow.getBounds());
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focus');
  });

  nativeTheme.on('updated', () => {
    if (mainWindow) {
      mainWindow.webContents.send('theme-change', nativeTheme.shouldUseDarkColors);
    }
  });
}

async function fetchCompletedPage(token, since, until) {
  const params = new URLSearchParams({
    since: fmtTodoistDate(since),
    until: fmtTodoistDate(until),
    limit: '200'
  });
  const url = `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`;

  const items = [];
  let cursor = null;
  do {
    const reqUrl = cursor ? `${url}&cursor=${encodeURIComponent(cursor)}` : url;
    const res = await todoistGet(reqUrl, token);
    if (!res.ok) {
      throw new Error(`Todoist API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    for (const it of (data.items || [])) {
      items.push({ id: it.id, content: it.content, completed_at: it.completed_at });
    }
    cursor = data.next_cursor || null;
  } while (cursor);

  return items;
}

async function fetchCompletedTasks(range) {
  const token = store.get('token') || process.env.TODOIST_API_KEY;
  if (!token || token === 'your_token_here') {
    throw new Error('NO_TOKEN');
  }

  const { since, until } = parseRequestedRange(range);
  const byId = new Map();
  for (const chunk of chunkCompletionRange(since, until)) {
    const pageItems = await fetchCompletedPage(token, chunk.since, chunk.until);
    for (const item of pageItems) {
      byId.set(String(item.id), item);
    }
  }

  const items = Array.from(byId.values());
  const completedRange = { since: fmtTodoistDate(since), until: fmtTodoistDate(until) };
  const lastFetched = Date.now();
  store.set('completed', items);
  store.set('completedRange', completedRange);
  store.set('lastFetched', lastFetched);
  return { items, completedRange, lastFetched };
}

ipcMain.handle('fetch-tasks', async (_e, range) => {
  if (fullSyncInFlight) return fullSyncInFlight;

  fullSyncInFlight = (async () => {
    try {
      const wait = Math.max(0, MIN_MS_BETWEEN_FULL_SYNCS - (Date.now() - lastFullSyncDone));
      if (wait > 0) await sleep(wait);
      return { ok: true, ...(await fetchCompletedTasks(range)) };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      lastFullSyncDone = Date.now();
      fullSyncInFlight = null;
    }
  })();

  return fullSyncInFlight;
});

ipcMain.handle('get-cached', () => ({
  items: store.get('completed'),
  completedRange: store.get('completedRange'),
  lastFetched: store.get('lastFetched')
}));

ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors);

ipcMain.handle('get-token', () => {
  const t = store.get('token') || process.env.TODOIST_API_KEY || '';
  return t && t !== 'your_token_here' ? t : '';
});

ipcMain.handle('set-token', async (_e, token) => {
  const clean = String(token || '').trim();
  if (!clean) {
    store.set('token', '');
    return { ok: false, error: 'Empty token' };
  }
  // Verify by hitting Todoist
  try {
    const res = await todoistGet(
      'https://api.todoist.com/api/v1/tasks/completed/by_completion_date?since=2026-05-10T00:00:00Z&until=2026-05-11T00:00:00Z&limit=1',
      clean
    );
    if (!res.ok) {
      return { ok: false, error: `Invalid token (HTTP ${res.status})` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  store.set('token', clean);
  return { ok: true };
});

ipcMain.handle('get-settings', () => ({
  theme: store.get('theme'),
  zoom: store.get('zoom'),
  showLabels: store.get('showLabels')
}));

ipcMain.handle('set-settings', (_e, partial) => {
  if (partial && typeof partial === 'object') {
    if (typeof partial.theme === 'string') store.set('theme', partial.theme);
    if (typeof partial.zoom === 'number' && partial.zoom > 0) store.set('zoom', partial.zoom);
    if (typeof partial.showLabels === 'boolean') store.set('showLabels', partial.showLabels);
  }
  return { ok: true };
});

ipcMain.handle('clear-token', () => {
  store.set('token', '');
  store.set('completed', []);
  store.set('completedRange', null);
  store.set('lastFetched', 0);
  return { ok: true };
});

ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
