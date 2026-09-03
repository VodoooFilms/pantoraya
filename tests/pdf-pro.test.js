const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { PdfProSessionManager } = require('../src/main/pdf-pro/session-manager');

async function fixture(directory, name = 'source.pdf') {
  const document = await PDFDocument.create();
  document.addPage([300, 500]);
  document.addPage([500, 300]);
  document.addPage([400, 400]);
  const filePath = path.join(directory, name);
  await fs.promises.writeFile(filePath, await document.save());
  return filePath;
}

test('PDF Pro session applies page operations and supports undo', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pantoraya-pdf-pro-test-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const manager = new PdfProSessionManager();
  const opened = await manager.create(await fixture(directory));
  assert.equal(opened.pageCount, 3);

  const first = opened.pages[0];
  const rotated = manager.apply(opened.sessionId, { type: 'rotate', pageIds: [first.id], delta: 90 });
  assert.equal(rotated.pages[0].rotation, 90);
  assert.equal(rotated.dirty, true);

  const reordered = manager.apply(opened.sessionId, { type: 'reorder', order: [...rotated.pages].reverse().map((page) => page.id) });
  assert.equal(reordered.pages[2].id, first.id);
  const undone = manager.undo(opened.sessionId);
  assert.equal(undone.pages[0].id, first.id);
  assert.equal(undone.dirty, true);
  const backToOriginal = manager.undo(opened.sessionId);
  assert.equal(backToOriginal.dirty, false);
});

test('PDF Pro exports a valid copy and extracts selected pages', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pantoraya-pdf-pro-export-test-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const manager = new PdfProSessionManager();
  const opened = await manager.create(await fixture(directory));
  const outputPath = path.join(directory, 'copy.pdf');
  await manager.export(opened.sessionId, outputPath, [opened.pages[1].id]);
  const output = await PDFDocument.load(await fs.promises.readFile(outputPath));
  assert.equal(output.getPageCount(), 1);
  assert.deepEqual(output.getPage(0).getSize(), { width: 500, height: 300 });
});
