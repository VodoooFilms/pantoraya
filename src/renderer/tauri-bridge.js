/*
 * Pantoraya Tauri bridge.
 *
 * Keeps the renderer untouched by exposing the same `window.pantoraya` API
 * that the Electron preload provides. Loaded after the page but before app.js.
 * When the app runs under Electron, `window.__TAURI__` is absent and the
 * preload bridge is left untouched.
 */
(function () {
  const tauri = window.__TAURI__;
  if (!tauri || window.pantoraya) return;

  const invoke = tauri.core.invoke;
  const listen = tauri.event.listen;

  const platform = /Mac/i.test(navigator.platform)
    ? 'darwin'
    : /Win/i.test(navigator.platform)
      ? 'win32'
      : 'linux';

  async function call(command, args) {
    try {
      return await invoke(command, args);
    } catch (error) {
      const message = typeof error === 'string'
        ? error
        : (error && error.message) || String(error);
      throw new Error(message);
    }
  }

  const progressListeners = new Set();
  const statusListeners = new Set();
  let progressReady = false;
  let statusReady = false;

  function ensureProgressListener() {
    if (progressReady) return;
    progressReady = true;
    listen('conversion-progress', (event) => {
      for (const callback of progressListeners) callback(event.payload);
    });
  }

  function ensureStatusListener() {
    if (statusReady) return;
    statusReady = true;
    listen('conversion-status', (event) => {
      for (const callback of statusListeners) callback(event.payload);
    });
  }

  const dropHandlers = { main: null, subtitle: null };

  function dropZoneFor(position) {
    if (!position || typeof position.x !== 'number') return 'main';
    const ratio = window.devicePixelRatio || 1;
    const element = document.elementFromPoint(position.x / ratio, position.y / ratio);
    return element && element.closest && element.closest('#subtitlePicker')
      ? 'subtitle'
      : 'main';
  }

  listen('tauri://drag-drop', (event) => {
    const payload = event.payload || {};
    const paths = payload.paths || [];
    if (!paths.length) return;
    const handler = dropHandlers[dropZoneFor(payload.position)];
    if (handler) handler(paths);
  });

  window.pantoraya = {
    platform,
    selectFiles: (converter) => call('select_files', { converterId: converter }),
    chooseOutputLocation: () => call('choose_output_location'),
    selectSubtitle: () => call('select_subtitle'),
    inspectFile: (filePath) => call('inspect_file', { filePath }),
    inspectFiles: (filePaths) => call('inspect_files', { filePaths }),
    inspectSubtitle: (filePath) => call('inspect_subtitle', { filePath }),
    convertMedia: (filePath, converter, profile, subtitlePath, options) => call('convert_media', {
      inputPath: filePath,
      converterId: converter,
      profileId: profile,
      subtitlePath,
      options
    }),
    cancelConversion: () => call('cancel_conversion'),
    showInFolder: (filePath) => call('show_in_folder', { filePath }),
    setLanguage: (language) => call('set_language', { language }),
    pathForFile: () => null,
    onProgress: (callback) => {
      progressListeners.add(callback);
      ensureProgressListener();
      return () => progressListeners.delete(callback);
    },
    onStatus: (callback) => {
      statusListeners.add(callback);
      ensureStatusListener();
      return () => statusListeners.delete(callback);
    },
    onFileDrop: (callback) => { dropHandlers.main = callback; },
    onSubtitleDrop: (callback) => { dropHandlers.subtitle = callback; },
    onDragState: (callback) => {
      const emit = (dragging) => (event) => callback({
        dragging,
        position: event.payload && event.payload.position ? event.payload.position : null
      });
      listen('tauri://drag-enter', emit(true));
      listen('tauri://drag-over', emit(true));
      listen('tauri://drag-leave', emit(false));
      listen('tauri://drag-drop', emit(false));
    }
  };
})();
