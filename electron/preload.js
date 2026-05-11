console.log('[preload] loading');
const { contextBridge, ipcRenderer } = require('electron');

try {
contextBridge.exposeInMainWorld('api', {
  fetchTasks: () => ipcRenderer.invoke('fetch-tasks'),
  getCached: () => ipcRenderer.invoke('get-cached'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onFocus: (cb) => ipcRenderer.on('window-focus', cb),
  onThemeChange: (cb) => ipcRenderer.on('theme-change', (_e, dark) => cb(dark))
});
console.log('[preload] api exposed');
} catch (err) {
  console.error('[preload] expose failed', err);
}
