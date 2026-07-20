const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pantoraya', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  inspectFile: (filePath) => ipcRenderer.invoke('inspect-file', filePath),
  convertMedia: (filePath, converter, profile) => ipcRenderer.invoke('convert-media', filePath, converter, profile),
  cancelConversion: () => ipcRenderer.invoke('cancel-conversion'),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
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
