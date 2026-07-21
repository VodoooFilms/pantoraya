const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

function helperPath(app) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'pdf', 'PantorayaPDF')
    : path.join(__dirname, '../../../build/pdf/PantorayaPDF');
}

const PDF_TOOLS = Object.freeze({
  compress: {
    profiles: new Set(['high', 'light'])
  },
  documentToPdf: {
    profiles: new Set(['document'])
  }
});

function startPdfTool({ app, toolId, inputPath, outputPath, profileId, onProgress }) {
  const tool = PDF_TOOLS[toolId];
  if (!tool || !tool.profiles.has(profileId)) throw new Error('PDF_TOOL_INVALID');
  const executable = helperPath(app);
  if (!fs.existsSync(executable)) {
    const error = new Error('PDF_HELPER_MISSING');
    error.code = 'PDF_HELPER_MISSING';
    throw error;
  }

  const child = spawn(executable, [inputPath, outputPath, profileId], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    const lines = stdout.split('\n');
    stdout = lines.pop() || '';
    for (const line of lines) {
      const match = line.match(/^PROGRESS\s+(\d+)$/);
      if (match) onProgress(Math.min(99, Number(match[1])));
    }
  });

  return child;
}

async function keepSmallestPdf(inputPath, outputPath) {
  const [input, output] = await Promise.all([fs.promises.stat(inputPath), fs.promises.stat(outputPath)]);
  if (output.size >= input.size) {
    await fs.promises.copyFile(inputPath, outputPath);
    return { outputBytes: input.size, usedOriginal: true };
  }
  return { outputBytes: output.size, usedOriginal: false };
}

async function compressPdfOnWindows({ inputPath, outputPath, profileId, onProgress, isCancelled }) {
  onProgress(12);
  const input = await fs.promises.readFile(inputPath);
  if (isCancelled()) throw Object.assign(new Error('PDF conversion cancelled.'), { code: 'CANCELLED' });

  let document;
  try {
    document = await PDFDocument.load(input, { updateMetadata: false });
  } catch (error) {
    if (/encrypt/i.test(error.message)) error.code = 'PDF_LOCKED';
    throw error;
  }

  onProgress(45);
  if (profileId === 'light') {
    document.setTitle('');
    document.setAuthor('');
    document.setSubject('');
    document.setKeywords([]);
    document.setProducer('Pantoraya');
    document.setCreator('Pantoraya');
  }

  const output = await document.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 25
  });
  if (isCancelled()) throw Object.assign(new Error('PDF conversion cancelled.'), { code: 'CANCELLED' });
  onProgress(88);
  await fs.promises.writeFile(outputPath, output);
  onProgress(100);
}

async function convertJpegToPdf({ inputPath, outputPath, onProgress, isCancelled }) {
  onProgress(12);
  const input = await fs.promises.readFile(inputPath);
  if (isCancelled()) throw Object.assign(new Error('PDF conversion cancelled.'), { code: 'CANCELLED' });

  const document = await PDFDocument.create();
  const image = await document.embedJpg(input);
  const { width, height } = image.scale(1);
  const page = document.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  onProgress(72);

  const output = await document.save({ useObjectStreams: true, addDefaultPage: false });
  if (isCancelled()) throw Object.assign(new Error('PDF conversion cancelled.'), { code: 'CANCELLED' });
  await fs.promises.writeFile(outputPath, output);
  onProgress(100);
}

module.exports = { PDF_TOOLS, compressPdfOnWindows, convertJpegToPdf, keepSmallestPdf, startPdfTool };
