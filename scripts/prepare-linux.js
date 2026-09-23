const { execFileSync } = require('child_process');
const fs = require('fs');

if (process.platform !== 'linux') throw new Error('This check is for Linux only.');

const ffmpeg = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find((candidate) => {
  try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch (_) { return false; }
});
if (!ffmpeg) throw new Error('FFmpeg is required. Install the ffmpeg package and try again.');

const encoders = execFileSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
const filters = execFileSync(ffmpeg, ['-hide_banner', '-filters'], { encoding: 'utf8' });
for (const encoder of ['libx264', 'aac', 'libmp3lame', 'mjpeg']) {
  if (!new RegExp(`\\b${encoder}\\b`).test(encoders)) throw new Error(`FFmpeg is missing the ${encoder} encoder.`);
}
for (const filter of ['scale', 'scale2ref', 'overlay']) {
  if (!new RegExp(`\\b${filter}\\b`).test(filters)) throw new Error(`FFmpeg is missing the ${filter} filter.`);
}
console.log(`Verified Linux FFmpeg: ${ffmpeg}`);
