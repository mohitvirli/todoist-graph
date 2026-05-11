const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const Store = require('electron-store');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const store = new Store({
  defaults: {
    bounds: { width: 720, height: 300, x: undefined, y: undefined },
    completed: [],
    lastFetched: 0
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

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
  const token = process.env.TODOIST_API_KEY;
  if (!token || token === 'your_token_here') {
    throw new Error('Missing TODOIST_API_KEY in .env');
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const sinceStr = since.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const url = `https://api.todoist.com/sync/v9/completed/get_all?limit=200&since=${encodeURIComponent(sinceStr)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Todoist API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const items = (data.items || []).map(it => ({
    id: it.id,
    content: it.content,
    completed_at: it.completed_at
  }));

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
