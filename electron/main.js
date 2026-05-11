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
    lastFetched: 0,
    token: ''
  }
});

let mainWindow = null;
const isDev = !app.isPackaged;

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

async function fetchCompletedTasks() {
  const token = store.get('token') || process.env.TODOIST_API_KEY;
  if (!token || token === 'your_token_here') {
    throw new Error('NO_TOKEN');
  }

  const until = new Date();
  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const params = new URLSearchParams({
    since: fmt(since),
    until: fmt(until),
    limit: '200'
  });
  const url = `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`;

  const items = [];
  let cursor = null;
  do {
    const reqUrl = cursor ? `${url}&cursor=${encodeURIComponent(cursor)}` : url;
    const res = await fetch(reqUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Todoist API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    for (const it of (data.items || [])) {
      items.push({ id: it.id, content: it.content, completed_at: it.completed_at });
      if (items.length >= 200) break;
    }
    cursor = data.next_cursor || null;
  } while (cursor && items.length < 200);

  store.set('completed', items);
  store.set('lastFetched', Date.now());
  return { items, lastFetched: Date.now() };
}

ipcMain.handle('fetch-tasks', async () => {
  try {
    return { ok: true, ...(await fetchCompletedTasks()) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-cached', () => ({
  items: store.get('completed'),
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
    const res = await fetch('https://api.todoist.com/api/v1/tasks/completed/by_completion_date?since=2026-05-10T00:00:00Z&until=2026-05-11T00:00:00Z&limit=1', {
      headers: { Authorization: `Bearer ${clean}` }
    });
    if (!res.ok) {
      return { ok: false, error: `Invalid token (HTTP ${res.status})` };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  store.set('token', clean);
  return { ok: true };
});

ipcMain.handle('clear-token', () => {
  store.set('token', '');
  store.set('completed', []);
  store.set('lastFetched', 0);
  return { ok: true };
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
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
