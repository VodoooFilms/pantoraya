const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findPreviewHtml } = require('../src/main/converters/document');

test('findPreviewHtml locates Quick Look output recursively', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-test-'));
  try {
    const preview = path.join(directory, 'document.qlpreview');
    fs.mkdirSync(preview);
    fs.writeFileSync(path.join(preview, 'Preview.html'), '<html></html>');
    assert.equal(findPreviewHtml(directory), path.join(preview, 'Preview.html'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('findPreviewHtml returns null when Quick Look emits no HTML', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-test-'));
  try {
    assert.equal(findPreviewHtml(directory), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
