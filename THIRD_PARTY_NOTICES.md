# Third-party notices

Pantoraya includes a separate FFmpeg executable built from unmodified upstream sources.
The executable is licensed under GNU GPL version 2 or later because it is linked with
x264. Pantoraya's application source remains MIT licensed; the bundled executable and
its libraries retain their own licenses.

- FFmpeg 8.1.2 — GPL-2.0-or-later — https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz
- x264 revision `b35605ace3ddf7c1a5d67a2eb553f034aef41d55` — GPL-2.0-or-later — https://code.videolan.org/videolan/x264
- LAME 3.100 — LGPL-2.0-or-later — https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz
- ShareX FFmpeg 8.1 Windows build — GPL-3.0 — https://github.com/ShareX/FFmpeg/releases/tag/v8.1
- pdf-lib 1.17.1 — MIT — https://github.com/Hopding/pdf-lib

The exact, checksum-verified build is reproducible with `npm run build:ffmpeg`. The
corresponding license texts are copied into the application during that build and are
distributed in its `Resources/licenses` directory.

The Windows build downloads the pinned ShareX FFmpeg archive and its GPL text with
SHA-256 verification through `npm run prepare:windows`.
