const { contextBridge, ipcRenderer, webFrame } = require('electron');

try {
  contextBridge.exposeInMainWorld('api', {
    fetchTasks: (range) => ipcRenderer.invoke('fetch-tasks', range),
    getCached: () => ipcRenderer.invoke('get-cached'),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    getToken: () => ipcRenderer.invoke('get-token'),
    setToken: (t) => ipcRenderer.invoke('set-token', t),
    clearToken: () => ipcRenderer.invoke('clear-token'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSettings: (s) => ipcRenderer.invoke('set-settings', s),
    setZoom: (factor) => {
      const f = Number(factor);
      if (f > 0) webFrame.setZoomFactor(f);
    },
    openExternal: (url) => ipcRenderer.send('open-external', url),
    closeWindow: () => ipcRenderer.send('window-close'),
    platform: process.platform,
    onFocus: (cb) => ipcRenderer.on('window-focus', cb),
    onThemeChange: (cb) => ipcRenderer.on('theme-change', (_e, dark) => cb(dark))
  });
} catch (err) {
  console.error('[preload] expose failed', err);
}
