const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pantoraya', {
  platform: process.platform,
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSubtitle: () => ipcRenderer.invoke('select-subtitle'),
  inspectFile: (filePath) => ipcRenderer.invoke('inspect-file', filePath),
  inspectSubtitle: (filePath) => ipcRenderer.invoke('inspect-subtitle', filePath),
  convertMedia: (filePath, converter, profile, subtitlePath) => ipcRenderer.invoke('convert-media', filePath, converter, profile, subtitlePath),
  cancelConversion: () => ipcRenderer.invoke('cancel-conversion'),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  saveOutputAs: (filePath, suggestedPath) => ipcRenderer.invoke('save-output-as', filePath, suggestedPath),
  discardOutput: (filePath) => ipcRenderer.invoke('discard-output', filePath),
  setLanguage: (language) => ipcRenderer.invoke('set-language', language),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('conversion-progress', listener);
    return () => ipcRenderer.removeListener('conversion-progress', listener);
  },
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('conversion-status', listener);
    return () => ipcRenderer.removeListener('conversion-status', listener);
  }
});
