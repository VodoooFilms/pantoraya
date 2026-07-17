const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let activeConversion = null;

const VIDEO_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.webm']);
const PROFILES = {
  quality: {
    suffix: '_mp4',
    label: 'Alta calidad',
    args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k']
  },
  light: {
    suffix: '_liviano',
    label: 'Liviano',
    args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '27', '-vf', 'scale=w=min(1280\\,iw):h=-2', '-c:a', 'aac', '-b:a', '112k']
  }
};

function getFfmpegPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg')]
    : [require('@ffmpeg-installer/ffmpeg').path, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function isSupportedVideo(filePath) {
  return typeof filePath === 'string' && VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function uniqueOutputPath(inputPath, profile) {
  const directory = path.dirname(inputPath);
  const name = path.basename(inputPath, path.extname(inputPath));
  let candidate = path.join(directory, `${name}${profile.suffix}.mp4`);
  let count = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${name}${profile.suffix}-${count}.mp4`);
    count += 1;
  }
  return candidate;
}

function parseTimestamp(value) {
  const match = value.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 410,
    height: 350,
    minWidth: 410,
    minHeight: 350,
    maxWidth: 410,
    maxHeight: 350,
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
        { role: 'about', label: 'Acerca de Pantoraya' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar Pantoraya' },
        { role: 'hideOthers', label: 'Ocultar otras' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de Pantoraya' }
      ]
    },
    { label: 'Edición', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ventana', submenu: [{ role: 'minimize', label: 'Minimizar' }, { role: 'zoom', label: 'Zoom' }, { role: 'front', label: 'Traer todo al frente' }] }
  ]));
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({ applicationName: 'Pantoraya', applicationVersion: app.getVersion(), copyright: '© 2026 Pantoraya' });
  createMenu();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecciona un video',
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mov', 'mp4', 'm4v', 'avi', 'mkv', 'webm'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const stats = await fs.promises.stat(filePath);
  return { path: filePath, name: path.basename(filePath), size: stats.size };
});

ipcMain.handle('inspect-file', async (_event, filePath) => {
  if (!isSupportedVideo(filePath) || !fs.existsSync(filePath)) throw new Error('El archivo no es un video compatible.');
  const stats = await fs.promises.stat(filePath);
  return { path: filePath, name: path.basename(filePath), size: stats.size };
});

ipcMain.handle('convert-video', async (_event, inputPath, profileId) => {
  if (activeConversion) throw new Error('Ya hay una conversión en curso.');
  if (!isSupportedVideo(inputPath) || !fs.existsSync(inputPath)) throw new Error('No se encontró un video compatible.');
  const profile = PROFILES[profileId];
  if (!profile) throw new Error('Perfil de compresión no válido.');
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) throw new Error('Pantoraya no encontró su motor FFmpeg. Reinstala la aplicación.');

  const outputPath = uniqueOutputPath(inputPath, profile);
  const inputBytes = (await fs.promises.stat(inputPath)).size;
  const args = ['-hide_banner', '-y', '-i', inputPath, ...profile.args, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath];

  return new Promise((resolve, reject) => {
    let duration = 0;
    let stderr = '';
    let wasCancelled = false;
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    activeConversion = { child, outputPath, cancel: () => { wasCancelled = true; child.kill('SIGTERM'); } };
    send('conversion-status', { status: 'starting', message: `Convirtiendo en modo ${profile.label}…` });

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
      reject(new Error(`No se pudo iniciar FFmpeg: ${error.message}`));
    });
    child.on('close', async (code) => {
      activeConversion = null;
      if (wasCancelled) {
        await fs.promises.rm(outputPath, { force: true }).catch(() => {});
        reject(new Error('Conversión cancelada.'));
        return;
      }
      if (code !== 0) {
        await fs.promises.rm(outputPath, { force: true }).catch(() => {});
        const detail = stderr.split('\n').filter(Boolean).slice(-3).join(' ');
        reject(new Error(detail || `FFmpeg terminó con código ${code}.`));
        return;
      }
      const outputBytes = (await fs.promises.stat(outputPath)).size;
      send('conversion-progress', { percent: 100, timemark: '' });
      resolve({ success: true, outputPath, outputBytes, inputBytes, profileId });
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
