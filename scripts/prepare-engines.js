const { execFileSync } = require('child_process');
const path = require('path');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const projectRoot = path.join(__dirname, '..');

if (process.platform === 'win32') {
  execFileSync(npm, ['run', 'prepare:windows'], { cwd: projectRoot, stdio: 'inherit' });
} else if (process.platform === 'darwin') {
  execFileSync(npm, ['run', 'build:ffmpeg'], { cwd: projectRoot, stdio: 'inherit' });
  execFileSync(npm, ['run', 'build:pdf-helper'], { cwd: projectRoot, stdio: 'inherit' });
} else {
  throw new Error('Pantoraya currently supports macOS and Windows.');
}
