const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('pantoraya', {
  platform: process.platform,
  selectFiles: (converter) => ipcRenderer.invoke('select-files', converter),
  chooseOutputLocation: () => ipcRenderer.invoke('choose-output-location'),
  selectSubtitle: () => ipcRenderer.invoke('select-subtitle'),
  inspectFile: (filePath) => ipcRenderer.invoke('inspect-file', filePath),
  inspectFiles: (filePaths) => ipcRenderer.invoke('inspect-files', filePaths),
  inspectSubtitle: (filePath) => ipcRenderer.invoke('inspect-subtitle', filePath),
  convertMedia: (filePath, converter, profile, subtitlePath, options) => ipcRenderer.invoke('convert-media', filePath, converter, profile, subtitlePath, options),
  cancelConversion: () => ipcRenderer.invoke('cancel-conversion'),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  saveOutputAs: (filePath, suggestedPath) => ipcRenderer.invoke('save-output-as', filePath, suggestedPath),
  discardOutput: (filePath) => ipcRenderer.invoke('discard-output', filePath),
  setLanguage: (language) => ipcRenderer.invoke('set-language', language),
  setWindowMode: (mode) => ipcRenderer.invoke('set-window-mode', mode),
  pdfProOpen: () => ipcRenderer.invoke('pdf-pro-open'),
  pdfProSource: (sessionId, sourceId) => ipcRenderer.invoke('pdf-pro-source', sessionId, sourceId),
  pdfProCommand: (sessionId, command) => ipcRenderer.invoke('pdf-pro-command', sessionId, command),
  pdfProUndo: (sessionId) => ipcRenderer.invoke('pdf-pro-undo', sessionId),
  pdfProRedo: (sessionId) => ipcRenderer.invoke('pdf-pro-redo', sessionId),
  pdfProImport: (sessionId, options) => ipcRenderer.invoke('pdf-pro-import', sessionId, options),
  pdfProExport: (sessionId) => ipcRenderer.invoke('pdf-pro-export', sessionId),
  pdfProExtract: (sessionId, pageIds) => ipcRenderer.invoke('pdf-pro-extract', sessionId, pageIds),
  pdfProCancelExport: (sessionId) => ipcRenderer.invoke('pdf-pro-cancel-export', sessionId),
  pdfProShowOutput: (filePath) => ipcRenderer.invoke('pdf-pro-show-output', filePath),
  pdfProCloseSession: (sessionId, discard) => ipcRenderer.invoke('pdf-pro-close-session', sessionId, discard),
  pdfProToggleFullscreen: () => ipcRenderer.invoke('pdf-pro-toggle-fullscreen'),
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
  },
  onPdfProProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pdf-pro-progress', listener);
    return () => ipcRenderer.removeListener('pdf-pro-progress', listener);
  },
  onPdfProSaveRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('pdf-pro-save-requested', listener);
    return () => ipcRenderer.removeListener('pdf-pro-save-requested', listener);
  }
});
