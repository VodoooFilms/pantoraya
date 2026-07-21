const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { compressPdfOnWindows, convertJpegToPdf, keepSmallestPdf } = require('../src/main/converters/pdf');

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

test('Windows PDF engine writes a valid PDF and reports progress', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-pdf-windows-test-'));
  try {
    const input = path.join(directory, 'input.pdf');
    const output = path.join(directory, 'output.pdf');
    const source = await PDFDocument.create();
    source.addPage([300, 400]);
    source.setTitle('Private title');
    fs.writeFileSync(input, await source.save());
    const progress = [];

    await compressPdfOnWindows({
      inputPath: input,
      outputPath: output,
      profileId: 'light',
      onProgress: (value) => progress.push(value),
      isCancelled: () => false
    });

    const result = await PDFDocument.load(fs.readFileSync(output));
    assert.equal(result.getPageCount(), 1);
    assert.equal(result.getTitle(), '');
    assert.deepEqual(progress, [12, 45, 88, 100]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('JPG conversion creates a one-page PDF at the image dimensions', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-jpg-pdf-test-'));
  try {
    const input = path.join(directory, 'input.jpg');
    const output = path.join(directory, 'output.pdf');
    fs.writeFileSync(input, Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=', 'base64'));
    const progress = [];

    await convertJpegToPdf({ inputPath: input, outputPath: output, onProgress: (value) => progress.push(value), isCancelled: () => false });

    const result = await PDFDocument.load(fs.readFileSync(output));
    assert.equal(result.getPageCount(), 1);
    assert.deepEqual(result.getPage(0).getSize(), { width: 1, height: 1 });
    assert.deepEqual(progress, [12, 72, 100]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
