const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('api', {
    fetchTasks: () => ipcRenderer.invoke('fetch-tasks'),
    getCached: () => ipcRenderer.invoke('get-cached'),
    getTheme: () => ipcRenderer.invoke('get-theme'),
    getToken: () => ipcRenderer.invoke('get-token'),
    setToken: (t) => ipcRenderer.invoke('set-token', t),
    clearToken: () => ipcRenderer.invoke('clear-token'),
    closeWindow: () => ipcRenderer.send('window-close'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onFocus: (cb) => ipcRenderer.on('window-focus', cb),
    onThemeChange: (cb) => ipcRenderer.on('theme-change', (_e, dark) => cb(dark))
  });
} catch (err) {
  console.error('[preload] expose failed', err);
}
