const { mkdirSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'build', 'pdf');
const outputPath = path.join(outputDirectory, 'PantorayaPDF');
const sourcePath = path.join(projectRoot, 'src', 'pdf', 'PantorayaPDF.swift');

mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync('/usr/bin/xcrun', [
  'swiftc', '-O',
  '-target', 'arm64-apple-macosx13.4',
  '-framework', 'AppKit',
  '-framework', 'PDFKit',
  '-o', outputPath,
  sourcePath
], { stdio: 'inherit' });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
