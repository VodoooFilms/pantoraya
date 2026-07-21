const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

module.exports = { PDF_TOOLS, keepSmallestPdf, startPdfTool };
