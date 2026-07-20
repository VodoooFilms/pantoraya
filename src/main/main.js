const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeImage } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let activeConversion = null;
let currentLanguage = 'es';

const TEXT = {
  es: {
    about: 'Acerca de Pantoraya', aboutCredit: 'Conversión privada de video, audio e imágenes. Todo ocurre localmente en tu Mac.', hide: 'Ocultar Pantoraya', hideOthers: 'Ocultar otras', unhide: 'Mostrar todo', quit: 'Salir de Pantoraya',
    edit: 'Edición', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo',
    window: 'Ventana', minimize: 'Minimizar', zoom: 'Zoom', front: 'Traer todo al frente',
    selectTitle: 'Selecciona un video, audio o imagen', compatible: 'Archivos compatibles', videos: 'Videos', audio: 'Audio', images: 'Imágenes',
    unsupported: 'El archivo no es un video, audio o imagen compatible.', active: 'Ya hay una conversión en curso.', missing: 'No se encontró un archivo compatible.',
    invalidProfile: 'Perfil de compresión no válido.', ffmpegMissing: 'Pantoraya no encontró su motor FFmpeg. Reinstala la aplicación.',
    quality: 'Alta calidad', light: 'Liviana', converting: 'Convirtiendo', startError: 'No se pudo iniciar FFmpeg', cancelled: 'Conversión cancelada.', ffmpegExit: 'FFmpeg terminó con código'
  },
  en: {
    about: 'About Pantoraya', aboutCredit: 'Private video, audio, and image conversion. Everything happens locally on your Mac.', hide: 'Hide Pantoraya', hideOthers: 'Hide Others', unhide: 'Show All', quit: 'Quit Pantoraya',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All',
    window: 'Window', minimize: 'Minimize', zoom: 'Zoom', front: 'Bring All to Front',
    selectTitle: 'Select a video, audio file, or image', compatible: 'Compatible files', videos: 'Videos', audio: 'Audio', images: 'Images',
    unsupported: 'The file is not a compatible video, audio file, or image.', active: 'A conversion is already in progress.', missing: 'No compatible file was found.',
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
const ALL_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS]);
const CONVERTERS = {
  mp4: {
    inputExtensions: VIDEO_EXTENSIONS,
    outputExtension: '.mp4',
    outputArgs: ['-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
    profiles: {
      quality: {
        suffix: { es: '_mp4', en: '_mp4' },
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
        args: ['-vn', '-c:a', 'libmp3lame', '-b:a', '320k']
      },
      light: {
        suffix: { es: '_mp3', en: '_mp3' },
        labelKey: 'light',
        args: ['-vn', '-c:a', 'libmp3lame', '-b:a', '128k']
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
        args: ['-c:v', 'mjpeg', '-q:v', '2', '-pix_fmt', 'yuvj420p']
      },
      light: {
        suffix: { es: '_comprimida', en: '_compressed' },
        labelKey: 'light',
        args: ['-c:v', 'mjpeg', '-q:v', '7', '-vf', 'scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease', '-pix_fmt', 'yuvj420p']
      }
    }
  }
};

function getFfmpegPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg')]
    : [require('@ffmpeg-installer/ffmpeg').path, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

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

function uniqueOutputPath(inputPath, converter, profile) {
  const directory = path.dirname(inputPath);
  const name = path.basename(inputPath, path.extname(inputPath));
  const suffix = profile.suffix[currentLanguage];
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

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function playCompletionSound() {
  const soundPath = '/System/Library/Sounds/Tink.aiff';
  if (!fs.existsSync(soundPath)) return;
  const sound = spawn('/usr/bin/afplay', ['-v', '0.35', soundPath], { detached: true, stdio: 'ignore' });
  sound.on('error', () => {});
  sound.unref();
}

async function requestInitialFolderPermissions() {
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
  mainWindow = new BrowserWindow({
    width: 410,
    height: 400,
    minWidth: 410,
    minHeight: 400,
    maxWidth: 410,
    maxHeight: 400,
    resizable: false,
    maximizable: false,
    title: 'Pantoraya',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
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
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createMenu() {
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

ipcMain.handle('set-language', async (_event, language) => {
  if (!TEXT[language]) return false;
  currentLanguage = language;
  updateAboutPanel();
  createMenu();
  return true;
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: t('selectTitle'),
    properties: ['openFile'],
    filters: [
      { name: t('compatible'), extensions: [...ALL_EXTENSIONS].map((extension) => extension.slice(1)) },
      { name: t('videos'), extensions: [...VIDEO_EXTENSIONS].map((extension) => extension.slice(1)) },
      { name: t('audio'), extensions: [...AUDIO_EXTENSIONS].map((extension) => extension.slice(1)) },
      { name: t('images'), extensions: [...IMAGE_EXTENSIONS].map((extension) => extension.slice(1)) }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return fileDetails(result.filePaths[0]);
});

ipcMain.handle('inspect-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !mediaTypeForFile(filePath) || !fs.existsSync(filePath)) {
    throw new Error(t('unsupported'));
  }
  return fileDetails(filePath);
});

ipcMain.handle('convert-media', async (_event, inputPath, converterId, profileId) => {
  if (activeConversion) throw new Error(t('active'));
  const converter = getConverter(converterId);
  if (!converter || !isSupportedInput(inputPath, converter) || !fs.existsSync(inputPath)) throw new Error(t('missing'));
  const profile = converter.profiles[profileId];
  if (!profile) throw new Error(t('invalidProfile'));
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error(t('ffmpegMissing'));

  const outputPath = uniqueOutputPath(inputPath, converter, profile);
  const inputBytes = (await fs.promises.stat(inputPath)).size;
  const args = ['-hide_banner', '-y', '-i', inputPath, ...profile.args, ...converter.outputArgs, outputPath];

  return new Promise((resolve, reject) => {
    let duration = 0;
    let stderr = '';
    let wasCancelled = false;
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
      activeConversion = null;
      reject(new Error(`${t('startError')}: ${error.message}`));
    });
    child.on('close', async (code) => {
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

ipcMain.handle('cancel-conversion', async () => {
  if (!activeConversion) return false;
  activeConversion.cancel();
  return true;
});

ipcMain.handle('show-in-folder', async (_event, filePath) => {
  if (typeof filePath === 'string' && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});
