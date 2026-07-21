const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

function findPreviewHtml(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findPreviewHtml(candidate);
      if (nested) return nested;
    } else if (entry.name === 'Preview.html') {
      return candidate;
    }
  }
  return null;
}

function runQuickLook(inputPath, directory, onChild) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/qlmanage', ['-p', '-o', directory, inputPath], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
    onChild(child);
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-8000); });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (signal) reject(Object.assign(new Error('Document conversion cancelled.'), { code: 'CANCELLED' }));
      else if (code === 0) resolve();
      else reject(new Error(stderr || 'Quick Look could not render this document.'));
    });
  });
}

async function convertWordToPdf({ inputPath, outputPath, onProgress, onChild }) {
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pantoraya-document-'));
  let previewWindow = null;
  try {
    onProgress(10);
    await runQuickLook(inputPath, temporaryDirectory, onChild);
    const htmlPath = findPreviewHtml(temporaryDirectory);
    if (!htmlPath) throw new Error('Quick Look did not create a printable preview.');

    const html = await fs.promises.readFile(htmlPath, 'utf8');
    await fs.promises.writeFile(
      htmlPath,
      html.replace(/\f/g, '<span style="display:block;break-before:page"></span>'),
      'utf8'
    );
    onProgress(45);

    previewWindow = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    previewWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    previewWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== pathToFileURL(htmlPath).href) event.preventDefault();
    });
    previewWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    await previewWindow.loadFile(htmlPath);
    onProgress(70);
    const pdf = await previewWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: { marginType: 'default' }
    });
    await fs.promises.writeFile(outputPath, pdf);
    onProgress(100);
  } finally {
    if (previewWindow && !previewWindow.isDestroyed()) previewWindow.destroy();
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

module.exports = { convertWordToPdf, findPreviewHtml };
