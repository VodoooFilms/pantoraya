const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeImage } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow = null;
let activeConversion = null;
let currentLanguage = 'es';

const TEXT = {
  es: {
    about: 'Acerca de Pantoraya', aboutCredit: 'Pantoraya es un conversor gratuito y de código abierto para macOS y Windows. Convierte video a MP4, extrae y comprime audio en MP3 y optimiza imágenes JPG. Todo ocurre de forma privada y local, sin cuentas, anuncios ni cargas a la nube.', hide: 'Ocultar Pantoraya', hideOthers: 'Ocultar otras', unhide: 'Mostrar todo', quit: 'Salir de Pantoraya',
    edit: 'Edición', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo',
    window: 'Ventana', minimize: 'Minimizar', zoom: 'Zoom', front: 'Traer todo al frente',
    selectTitle: 'Selecciona uno o varios archivos', outputFolderTitle: 'Selecciona la carpeta de salida', compatible: 'Archivos compatibles', videos: 'Videos', audio: 'Audio', images: 'Imágenes',
    unsupported: 'El archivo no tiene un formato compatible.', active: 'Ya hay una conversión en curso.', missing: 'No se encontró un archivo compatible.',
    invalidProfile: 'Perfil de compresión no válido.', ffmpegMissing: 'Pantoraya no encontró su motor FFmpeg. Reinstala la aplicación.',
    quality: 'Alta calidad', light: 'Liviana', converting: 'Convirtiendo', startError: 'No se pudo iniciar FFmpeg', cancelled: 'Conversión cancelada.', ffmpegExit: 'FFmpeg terminó con código'
  },
  en: {
    about: 'About Pantoraya', aboutCredit: 'Pantoraya is a free, open-source converter for macOS and Windows. It converts video to MP4, extracts and compresses audio as MP3, and optimizes JPG images. Everything happens privately and locally, with no accounts, ads, or cloud uploads.', hide: 'Hide Pantoraya', hideOthers: 'Hide Others', unhide: 'Show All', quit: 'Quit Pantoraya',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    window: 'Window', minimize: 'Minimize', zoom: 'Zoom', front: 'Bring All to Front',
    selectTitle: 'Select one or more files', outputFolderTitle: 'Select the output folder', compatible: 'Compatible files', videos: 'Videos', audio: 'Audio', images: 'Images',
    unsupported: 'The file format is not supported.', active: 'A conversion is already in progress.', missing: 'No compatible file was found.',
    invalidProfile: 'Invalid compression profile.', ffmpegMissing: 'Pantoraya could not find its FFmpeg engine. Reinstall the application.',
    quality: 'High quality', light: 'Lightweight', converting: 'Converting', startError: 'Could not start FFmpeg', cancelled: 'Conversion cancelled.', ffmpegExit: 'FFmpeg exited with code'
  }
};

function t(key) {
  return TEXT[currentLanguage][key];
}

const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.webm']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wma', '.aif', '.aiff']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);
const SUBTITLE_EXTENSIONS = new Set(['.srt']);
const ALL_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS]);
const CONVERTERS = {
  mp4: {
    inputExtensions: VIDEO_EXTENSIONS,
    outputExtension: '.mp4',
    outputArgs: ['-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
    profiles: {
      quality: {
        suffix: { es: '', en: '' },
        labelKey: 'quality',
        args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k']
      },
      light: {
        suffix: { es: '_liviano', en: '_light' },
        labelKey: 'light',
        args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '27', '-vf', 'scale=w=min(1280\\,iw):h=min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2', '-c:a', 'aac', '-b:a', '192k']
      }
    }
  },
  mp3: {
    inputExtensions: new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS]),
    outputExtension: '.mp3',
    outputArgs: ['-map_metadata', '0', '-id3v2_version', '3'],
    profiles: {
      high: {
        suffix: { es: '_mp3', en: '_mp3' },
        labelKey: 'quality',
        args: ['-c:a', 'libmp3lame', '-b:a', '320k']
      },
      light: {
        suffix: { es: '_mp3-liviano', en: '_mp3-light' },
        labelKey: 'light',
        args: ['-c:a', 'libmp3lame', '-b:a', '128k']
      }
    }
  },
  jpg: {
    inputExtensions: IMAGE_EXTENSIONS,
    outputExtension: '.jpg',
    outputArgs: ['-frames:v', '1', '-update', '1', '-map_metadata', '0'],
    profiles: {
      high: {
        suffix: { es: '_comprimida', en: '_compressed' },
        labelKey: 'quality',
        args: ['-filter_complex', '[0:v]format=rgba[fg];color=c=white:s=16x16[bg];[bg][fg]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,format=yuvj420p[v]', '-map', '[v]', '-c:v', 'mjpeg', '-q:v', '2']
      },
      light: {
        suffix: { es: '_liviana', en: '_light' },
        labelKey: 'light',
        args: ['-filter_complex', '[0:v]scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease,format=rgba[fg];color=c=white:s=16x16[bg];[bg][fg]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,format=yuvj420p[v]', '-map', '[v]', '-c:v', 'mjpeg', '-q:v', '7']
      }
    }
  }
};

function getFfmpegPath() {
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'ffmpeg', executable)]
    : process.platform === 'win32'
      ? [path.join(__dirname, '../../build/windows/ffmpeg.exe'), 'ffmpeg.exe']
      : [path.join(__dirname, '../../build/ffmpeg/ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function getConverter(converterId) {
  return CONVERTERS[converterId] || null;
}

function isSupportedInput(filePath, converter) {
  return typeof filePath === 'string' && converter.inputExtensions.has(path.extname(filePath).toLowerCase());
}

function mediaTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  return null;
}

function uniqueOutputPath(inputPath, converter, profile, outputDirectory = null) {
 const directory = outputDirectory || path.dirname(inputPath);
 const name = path.basename(inputPath, path.extname(inputPath));
 const inputExt = path.extname(inputPath).toLowerCase();
 const sameExtension = inputExt === converter.outputExtension;
 const suffix = sameExtension ? '' : (profile.suffix[currentLanguage] || '');
 let candidate = path.join(directory, `${name}${suffix}${converter.outputExtension}`);
  let count = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${name}${suffix}-${count}${converter.outputExtension}`);
    count += 1;
  }
  return candidate;
}

function parseTimestamp(value) {
  const match = value.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function probeFile(filePath) {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) return Promise.resolve({ duration: 0, width: 0, height: 0 });

  return new Promise((resolve) => {
    let stderr = '';
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const durationMatch = stderr.match(/Duration:\s*([\d:.]+)/);
      const videoMatch = stderr.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
      resolve({
        duration: durationMatch ? parseTimestamp(durationMatch[1]) : 0,
        width: videoMatch ? Number(videoMatch[1]) : 0,
        height: videoMatch ? Number(videoMatch[2]) : 0
      });
    };
    const child = spawn(ffmpegPath, ['-hide_banner', '-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-32000); });
    child.on('error', finish);
    child.on('close', finish);
  });
}

function fittedThumbnailSize(width, height) {
  if (!width || !height) return { width: 252, height: 252 };
  const scale = Math.min(732 / width, 252 / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function thumbnailForFile(filePath, mediaType, media) {
  if (mediaType === 'image') {
    const source = nativeImage.createFromPath(filePath);
    if (!source.isEmpty()) {
      const sourceSize = source.getSize();
      return source.resize({ ...fittedThumbnailSize(sourceSize.width, sourceSize.height), quality: 'good' }).toDataURL();
    }
  }

  const targetSize = fittedThumbnailSize(media.width, media.height);
  return Promise.race([
    nativeImage.createThumbnailFromPath(filePath, targetSize)
      .then((thumbnail) => thumbnail.isEmpty() ? null : thumbnail.toDataURL())
      .catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 3000))
  ]);
}

async function fileDetails(filePath) {
  const mediaType = mediaTypeForFile(filePath);
  const [stats, media] = await Promise.all([fs.promises.stat(filePath), probeFile(filePath)]);
  const thumbnail = await thumbnailForFile(filePath, mediaType, media);
  return { path: filePath, name: path.basename(filePath), size: stats.size, mediaType, thumbnail, ...media };
}

async function fileDetailsForPaths(filePaths, concurrency = 4) {
  const results = new Array(filePaths.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, filePaths.length) }, async () => {
    while (nextIndex < filePaths.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fileDetails(filePaths[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function playCompletionSound() {
  if (process.platform === 'win32') {
    const sound = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '[System.Media.SystemSounds]::Asterisk.Play()'], { detached: true, stdio: 'ignore', windowsHide: true });
    sound.on('error', () => {});
    sound.unref();
    return;
  }
  const soundPath = '/System/Library/Sounds/Tink.aiff';
  if (!fs.existsSync(soundPath)) return;
  const sound = spawn('/usr/bin/afplay', ['-v', '0.35', soundPath], { detached: true, stdio: 'ignore' });
  sound.on('error', () => {});
  sound.unref();
}

async function requestInitialFolderPermissions() {
  if (process.platform !== 'darwin') return;
  for (const folderName of ['desktop', 'documents', 'downloads']) {
    try {
      const directory = await fs.promises.opendir(app.getPath(folderName));
      await directory.close();
    } catch (_) {
      // macOS manages denials and future changes from System Settings.
    }
  }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 410,
    height: 400,
    useContentSize: true,
    minWidth: 410,
    minHeight: 400,
    maxWidth: 410,
    maxHeight: 400,
    resizable: false,
    maximizable: false,
    title: 'Pantoraya',
    ...(isMac ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 14, y: 14 } } : {}),
    backgroundColor: '#1d1d1f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  const rendererUrl = pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

function assertTrustedEvent(event) {
  const expected = pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  if (!event.senderFrame || event.senderFrame.url !== expected) throw new Error('Untrusted renderer request.');
}

function createMenu() {
  if (process.platform === 'win32') {
    const es = currentLanguage === 'es';
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: es ? 'Archivo' : 'File', submenu: [{ role: 'quit', label: t('quit') }] },
      { label: t('edit'), submenu: [{ role: 'undo', label: t('undo') }, { role: 'redo', label: t('redo') }, { type: 'separator' }, { role: 'cut', label: t('cut') }, { role: 'copy', label: t('copy') }, { role: 'paste', label: t('paste') }, { role: 'selectAll', label: t('selectAll') }] },
      { label: t('window'), submenu: [{ role: 'minimize', label: t('minimize') }, { role: 'close', label: es ? 'Cerrar' : 'Close' }] },
      { label: es ? 'Ayuda' : 'Help', submenu: [{ label: t('about'), click: () => app.showAboutPanel() }] }
    ]));
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Pantoraya',
      submenu: [
        { role: 'about', label: t('about') },
        { type: 'separator' },
        { role: 'hide', label: t('hide') },
        { role: 'hideOthers', label: t('hideOthers') },
        { role: 'unhide', label: t('unhide') },
        { type: 'separator' },
        { role: 'quit', label: t('quit') }
      ]
    },
    { label: t('edit'), submenu: [{ role: 'undo', label: t('undo') }, { role: 'redo', label: t('redo') }, { type: 'separator' }, { role: 'cut', label: t('cut') }, { role: 'copy', label: t('copy') }, { role: 'paste', label: t('paste') }, { role: 'selectAll', label: t('selectAll') }] },
    { label: t('window'), submenu: [{ role: 'minimize', label: t('minimize') }, { role: 'zoom', label: t('zoom') }, { role: 'front', label: t('front') }] }
  ]));
}

function updateAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: 'Pantoraya',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 Pantoraya',
    credits: t('aboutCredit'),
    website: 'https://github.com/VodoooFilms/pantoraya'
  });
}

app.whenReady().then(() => {
  updateAboutPanel();
  createMenu();
  createWindow();
  setTimeout(() => { requestInitialFolderPermissions(); }, 800);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('set-language', async (event, language) => {
  assertTrustedEvent(event);
  if (!TEXT[language]) return false;
  currentLanguage = language;
  updateAboutPanel();
  createMenu();
  return true;
});

ipcMain.handle('select-files', async (event, converterId) => {
  assertTrustedEvent(event);
  const converter = getConverter(converterId);
  const compatibleExtensions = converter ? [...converter.inputExtensions] : [...ALL_EXTENSIONS];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: t('selectTitle'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: t('compatible'), extensions: compatibleExtensions.map((extension) => extension.slice(1)) },
      { name: t('videos'), extensions: [...VIDEO_EXTENSIONS].map((extension) => extension.slice(1)) },
      { name: t('audio'), extensions: [...AUDIO_EXTENSIONS].map((extension) => extension.slice(1)) },
      { name: t('images'), extensions: [...IMAGE_EXTENSIONS].map((extension) => extension.slice(1)) }
    ]
  });
  if (result.canceled || !result.filePaths.length) return [];
  const compatiblePaths = converter
    ? result.filePaths.filter((filePath) => isSupportedInput(filePath, converter))
    : result.filePaths;
  return fileDetailsForPaths(compatiblePaths);
});

ipcMain.handle('choose-output-location', async (event) => {
  assertTrustedEvent(event);
  const sameFolder = currentLanguage === 'es' ? 'Misma carpeta' : 'Same folder';
  const chooseFolder = currentLanguage === 'es' ? 'Elegir carpeta…' : 'Choose folder…';
  const cancel = currentLanguage === 'es' ? 'Cancelar' : 'Cancel';
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    message: currentLanguage === 'es' ? '¿Dónde guardar las conversiones?' : 'Where should conversions be saved?',
    detail: currentLanguage === 'es' ? 'Puedes guardarlas junto a los originales o elegir otra carpeta.' : 'Save them next to the originals or choose another folder.',
    buttons: [sameFolder, chooseFolder, cancel],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });
  if (choice.response === 2) return { canceled: true, path: null };
  if (choice.response === 0) return { canceled: false, path: null };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: t('outputFolderTitle'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true, path: null };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('inspect-file', async (_event, filePath) => {
  assertTrustedEvent(_event);
  if (typeof filePath !== 'string' || !mediaTypeForFile(filePath) || !fs.existsSync(filePath)) {
    throw new Error(t('unsupported'));
  }
  return fileDetails(filePath);
});

ipcMain.handle('inspect-files', async (event, filePaths) => {
  assertTrustedEvent(event);
  if (!Array.isArray(filePaths) || filePaths.some((filePath) => typeof filePath !== 'string' || !mediaTypeForFile(filePath) || !fs.existsSync(filePath))) {
    throw new Error(t('unsupported'));
  }
  return fileDetailsForPaths(filePaths);
});

ipcMain.handle('select-subtitle', async (event) => {
  assertTrustedEvent(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: currentLanguage === 'es' ? 'Selecciona subtítulos SRT' : 'Select SRT subtitles',
    properties: ['openFile'],
    filters: [{ name: 'SubRip', extensions: ['srt'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return { path: result.filePaths[0], name: path.basename(result.filePaths[0]) };
});

ipcMain.handle('inspect-subtitle', async (event, filePath) => {
  assertTrustedEvent(event);
  if (typeof filePath !== 'string' || !SUBTITLE_EXTENSIONS.has(path.extname(filePath).toLowerCase()) || !fs.existsSync(filePath)) {
    throw new Error(t('unsupported'));
  }
  return { path: filePath, name: path.basename(filePath) };
});

ipcMain.handle('convert-media', async (_event, inputPath, converterId, profileId, subtitlePath = null, options = {}) => {
  assertTrustedEvent(_event);
  options = options && typeof options === 'object' ? options : {};
  if (activeConversion) throw new Error(t('active'));
  const converter = getConverter(converterId);
  if (!converter || !isSupportedInput(inputPath, converter) || !fs.existsSync(inputPath)) throw new Error(t('missing'));
  const profile = converter.profiles[profileId];
  if (!profile) throw new Error(t('invalidProfile'));
  if (subtitlePath !== null && (converterId !== 'mp4' || typeof subtitlePath !== 'string' || !SUBTITLE_EXTENSIONS.has(path.extname(subtitlePath).toLowerCase()) || !fs.existsSync(subtitlePath))) {
    throw new Error(t('unsupported'));
  }

  const outputDirectory = typeof options.outputDirectory === 'string' && fs.existsSync(options.outputDirectory)
    ? options.outputDirectory
    : null;
  const outputPath = uniqueOutputPath(inputPath, converter, profile, outputDirectory);
  const inputBytes = (await fs.promises.stat(inputPath)).size;
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error(t('ffmpegMissing'));
  const streamArgs = converterId === 'mp3'
    ? (VIDEO_EXTENSIONS.has(path.extname(inputPath).toLowerCase())
      ? ['-vn']
      : ['-map', '0:a:0', '-map', '0:v?', '-c:v', 'copy', '-disposition:v', 'attached_pic'])
    : subtitlePath
      ? ['-map', '0:v:0', '-map', '0:a?', '-map', '1:0', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=und']
      : [];
  const subtitleInputArgs = subtitlePath ? ['-i', subtitlePath] : [];
  const args = ['-hide_banner', '-y', '-i', inputPath, ...subtitleInputArgs, ...streamArgs, ...profile.args, ...converter.outputArgs, outputPath];

  return new Promise((resolve, reject) => {
    let duration = 0;
    let stderr = '';
    let wasCancelled = false;
    let settled = false;
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    activeConversion = { child, outputPath, cancel: () => { wasCancelled = true; child.kill('SIGTERM'); } };
    send('conversion-status', { status: 'starting', message: `${t('converting')} · ${t(profile.labelKey)}…` });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-16000);
      const durationMatch = chunk.match(/Duration:\s*([\d:.]+)/);
      if (durationMatch) duration = parseTimestamp(durationMatch[1]);
      const times = [...chunk.matchAll(/time=\s*([\d:.]+)/g)];
      if (duration && times.length) {
        const current = parseTimestamp(times[times.length - 1][1]);
        send('conversion-progress', { percent: Math.min(99, Math.max(0, Math.round((current / duration) * 100))), timemark: times[times.length - 1][1].trim() });
      }
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      activeConversion = null;
      reject(new Error(`${t('startError')}: ${error.message}`));
    });
    child.on('close', async (code) => {
      if (settled) return;
      settled = true;
      activeConversion = null;
      if (wasCancelled) {
        await fs.promises.rm(outputPath, { force: true }).catch(() => {});
        reject(new Error(t('cancelled')));
        return;
      }
      if (code !== 0) {
        await fs.promises.rm(outputPath, { force: true }).catch(() => {});
        const detail = stderr.split('\n').filter(Boolean).slice(-3).join(' ');
        reject(new Error(detail || `${t('ffmpegExit')} ${code}.`));
        return;
      }
      const outputBytes = (await fs.promises.stat(outputPath)).size;
      send('conversion-progress', { percent: 100, timemark: '' });
      playCompletionSound();
      resolve({ success: true, outputPath, outputBytes, inputBytes, converterId, profileId });
    });
  });
});

ipcMain.handle('cancel-conversion', async (event) => {
  assertTrustedEvent(event);
  if (!activeConversion) return false;
  activeConversion.cancel();
  return true;
});

ipcMain.handle('show-in-folder', async (_event, filePath) => {
  assertTrustedEvent(_event);
  if (typeof filePath === 'string' && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});