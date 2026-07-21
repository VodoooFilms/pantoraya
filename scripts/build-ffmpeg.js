const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, 'build', 'ffmpeg');
const outputPath = path.join(outputDirectory, 'ffmpeg');
const licenseDirectory = path.join(root, 'build', 'licenses');
const minimumMacOS = '13.4';
const ffmpeg = {
  version: '8.1.2',
  url: 'https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz',
  sha256: '464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c'
};
const lame = {
  version: '3.100',
  url: 'https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz',
  sha256: 'ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e'
};
const x264Revision = 'b35605ace3ddf7c1a5d67a2eb553f034aef41d55';

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function download(url, destination, sha256) {
  run('/usr/bin/curl', ['--fail', '--location', '--retry', '3', '--output', destination, url]);
  const digest = createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
  if (digest !== sha256) throw new Error(`Checksum mismatch for ${path.basename(destination)}`);
}

function usableExistingBinary() {
  if (!fs.existsSync(outputPath)) return false;
  try {
    const version = capture(outputPath, ['-version']);
    const decoders = capture(outputPath, ['-hide_banner', '-decoders']);
    const links = capture('/usr/bin/otool', ['-L', outputPath]);
    return version.startsWith(`ffmpeg version ${ffmpeg.version}`)
      && version.includes('--enable-gpl')
      && !version.includes('--enable-nonfree')
      && /^\s*V\S*\s+png\s+/m.test(decoders)
      && !links.includes('/opt/homebrew/')
      && !links.includes('/usr/local/');
  } catch (_) {
    return false;
  }
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('Pantoraya currently builds its FFmpeg engine on Apple silicon macOS only.');
}

if (usableExistingBinary()) {
  console.log('Pantoraya FFmpeg is already built and verified.');
  process.exit(0);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoraya-ffmpeg-'));
const prefix = path.join(work, 'prefix');
const environment = {
  ...process.env,
  MACOSX_DEPLOYMENT_TARGET: minimumMacOS,
  CFLAGS: `-O2 -mmacosx-version-min=${minimumMacOS}`,
  CXXFLAGS: `-O2 -mmacosx-version-min=${minimumMacOS}`,
  LDFLAGS: `-mmacosx-version-min=${minimumMacOS}`,
  PKG_CONFIG_PATH: path.join(prefix, 'lib', 'pkgconfig')
};

try {
  fs.mkdirSync(prefix, { recursive: true });

  const lameArchive = path.join(work, 'lame.tar.gz');
  download(lame.url, lameArchive, lame.sha256);
  run('/usr/bin/tar', ['-xzf', lameArchive, '-C', work]);
  const lameSource = path.join(work, `lame-${lame.version}`);
  run(path.join(lameSource, 'configure'), [
    `--prefix=${prefix}`, '--disable-shared', '--enable-static', '--disable-frontend'
  ], { cwd: lameSource, env: environment });
  run('/usr/bin/make', ['-j', String(os.availableParallelism())], { cwd: lameSource, env: environment });
  run('/usr/bin/make', ['install'], { cwd: lameSource, env: environment });

  const x264Source = path.join(work, 'x264');
  run('/usr/bin/git', ['init', x264Source]);
  run('/usr/bin/git', ['-C', x264Source, 'remote', 'add', 'origin', 'https://code.videolan.org/videolan/x264.git']);
  run('/usr/bin/git', ['-C', x264Source, 'fetch', '--depth', '1', 'origin', x264Revision]);
  run('/usr/bin/git', ['-C', x264Source, 'checkout', '--detach', 'FETCH_HEAD']);
  run('./configure', [
    `--prefix=${prefix}`, '--enable-static', '--disable-cli', '--disable-opencl'
  ], { cwd: x264Source, env: environment });
  run('/usr/bin/make', ['-j', String(os.availableParallelism())], { cwd: x264Source, env: environment });
  run('/usr/bin/make', ['install-lib-static'], { cwd: x264Source, env: environment });

  const ffmpegArchive = path.join(work, 'ffmpeg.tar.xz');
  download(ffmpeg.url, ffmpegArchive, ffmpeg.sha256);
  run('/usr/bin/tar', ['-xJf', ffmpegArchive, '-C', work]);
  const ffmpegSource = path.join(work, `ffmpeg-${ffmpeg.version}`);
  run(path.join(ffmpegSource, 'configure'), [
    `--prefix=${prefix}`,
    '--disable-shared', '--enable-static', '--disable-autodetect', '--disable-doc', '--disable-debug',
    '--disable-ffplay', '--disable-ffprobe', '--disable-network', '--enable-gpl', '--enable-zlib', '--enable-libx264',
    '--enable-libmp3lame', `--extra-cflags=-I${prefix}/include -mmacosx-version-min=${minimumMacOS}`,
    `--extra-ldflags=-L${prefix}/lib -mmacosx-version-min=${minimumMacOS}`, '--pkg-config-flags=--static'
  ], { cwd: ffmpegSource, env: environment });
  run('/usr/bin/make', ['-j', String(os.availableParallelism())], { cwd: ffmpegSource, env: environment });
  run('/usr/bin/make', ['install'], { cwd: ffmpegSource, env: environment });

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.copyFileSync(path.join(prefix, 'bin', 'ffmpeg'), outputPath);
  fs.chmodSync(outputPath, 0o755);
  fs.mkdirSync(licenseDirectory, { recursive: true });
  fs.copyFileSync(path.join(ffmpegSource, 'COPYING.GPLv2'), path.join(licenseDirectory, 'FFmpeg-GPL-2.0.txt'));
  fs.copyFileSync(path.join(x264Source, 'COPYING'), path.join(licenseDirectory, 'x264-GPL-2.0.txt'));
  fs.copyFileSync(path.join(lameSource, 'COPYING'), path.join(licenseDirectory, 'LAME-LGPL.txt'));

  if (!usableExistingBinary()) throw new Error('The resulting FFmpeg binary did not pass redistribution checks.');
  console.log(`Verified Pantoraya FFmpeg: ${outputPath}`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
