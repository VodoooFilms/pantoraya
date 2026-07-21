const { createHash } = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const extract = require('extract-zip');

const projectRoot = path.join(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'build', 'windows');
const outputPath = path.join(outputDirectory, 'ffmpeg.exe');
const markerPath = path.join(outputDirectory, 'ffmpeg.sha256');
const licenseDirectory = path.join(projectRoot, 'build', 'licenses');

const downloads = {
  ffmpeg: {
    url: 'https://github.com/ShareX/FFmpeg/releases/download/v8.1/ffmpeg-8.1-win-x64.zip',
    sha256: '1838932e32f01e0e7b65fde5ca0ebb2ab131cb6a9ff1a84025ee5b784075576c'
  },
  license: {
    url: 'https://raw.githubusercontent.com/ShareX/FFmpeg/master/LICENSE.txt',
    sha256: '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986'
  }
};

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Pantoraya-build' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 8) {
        response.resume();
        download(response.headers.location, destination, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function digest(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findFile(directory, fileName) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(candidate, fileName);
      if (nested) return nested;
    } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
      return candidate;
    }
  }
  return null;
}

async function verifiedDownload(downloadInfo, destination) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await download(downloadInfo.url, destination);
      if (digest(destination) !== downloadInfo.sha256) {
        throw new Error(`Checksum mismatch for ${path.basename(destination)}`);
      }
      return;
    } catch (error) {
      lastError = error;
      fs.rmSync(destination, { force: true });
    }
  }
  throw lastError;
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(licenseDirectory, { recursive: true });
  const existingMarker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : '';
  if (!fs.existsSync(outputPath) || existingMarker !== downloads.ffmpeg.sha256) {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-windows-'));
    try {
      const archivePath = path.join(temporaryDirectory, 'ffmpeg.zip');
      const extractedPath = path.join(temporaryDirectory, 'extracted');
      await verifiedDownload(downloads.ffmpeg, archivePath);
      await extract(archivePath, { dir: extractedPath });
      const executable = findFile(extractedPath, 'ffmpeg.exe');
      if (!executable) throw new Error('The FFmpeg archive did not contain ffmpeg.exe.');
      fs.copyFileSync(executable, outputPath);
      fs.writeFileSync(markerPath, `${downloads.ffmpeg.sha256}\n`);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }

  const licensePath = path.join(licenseDirectory, 'FFmpeg-GPL-3.0.txt');
  if (!fs.existsSync(licensePath) || digest(licensePath) !== downloads.license.sha256) {
    await verifiedDownload(downloads.license, licensePath);
  }
  console.log(`Verified Windows FFmpeg: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
