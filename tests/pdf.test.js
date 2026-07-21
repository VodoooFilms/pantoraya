const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { keepSmallestPdf } = require('../src/main/converters/pdf');

test('PDF compression never returns a file larger than its input', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-pdf-test-'));
  try {
    const input = path.join(directory, 'input.pdf');
    const output = path.join(directory, 'output.pdf');
    fs.writeFileSync(input, Buffer.alloc(100, 1));
    fs.writeFileSync(output, Buffer.alloc(160, 2));
    const result = await keepSmallestPdf(input, output);
    assert.deepEqual(result, { outputBytes: 100, usedOriginal: true });
    assert.deepEqual(fs.readFileSync(output), fs.readFileSync(input));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('PDF compression keeps a genuinely smaller result', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-pdf-test-'));
  try {
    const input = path.join(directory, 'input.pdf');
    const output = path.join(directory, 'output.pdf');
    fs.writeFileSync(input, Buffer.alloc(100, 1));
    fs.writeFileSync(output, Buffer.alloc(60, 2));
    assert.deepEqual(await keepSmallestPdf(input, output), { outputBytes: 60, usedOriginal: false });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
