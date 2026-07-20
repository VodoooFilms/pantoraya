<p align="center">
  <img src="assets/icons/icon.png" width="112" alt="Pantoraya icon">
</p>

<h1 align="center">Pantoraya</h1>

<p align="center">
  Private media conversion for macOS.<br>
  Video, audio, and images — processed locally, never uploaded.
</p>

<p align="center">
  <a href="README.es.md">Español</a> ·
  <a href="https://github.com/VodoooFilms/pantoraya/releases/latest">Download</a> ·
  <a href="LICENSE">MIT License</a>
</p>

## What is Pantoraya?

Pantoraya is a small, free, and open-source media converter designed for macOS. Drop a file into the app and Pantoraya automatically chooses the right workspace: MP4 for video, MP3 for audio, or JPG for images.

The app is deliberately focused. There are no accounts, subscriptions, uploads, ads, or complicated export panels. FFmpeg runs entirely on your Mac, and every output is saved next to its source file.

## Highlights

- Automatic video, audio, and image detection
- MP4 conversion with high-quality and lightweight 720p modes
- MP3 conversion and audio extraction from video at 320 or 128 kbps
- JPG compression with original-size and lightweight 1280 px modes
- Estimated output size before conversion
- Proportional file thumbnails without stretching
- Real-time progress and a subtle completion sound
- Light and dark themes
- English and Spanish interface
- Fully offline operation

## Supported formats

| Workspace | Input | Output | Modes |
| --- | --- | --- | --- |
| MP4 | MOV, MP4, M4V, AVI, MKV, WEBM | H.264 + AAC MP4 | High quality · Lightweight 720p |
| MP3 | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, AIFF, plus video files | MP3 | 320 kbps · 128 kbps |
| JPG | JPG, JPEG, PNG, WEBP, BMP, TIFF | JPG | Original dimensions · Lightweight 1280 px |

## Download and install

Pantoraya currently supports Apple Silicon Macs running macOS 11 or later.

1. Download the latest DMG from [GitHub Releases](https://github.com/VodoooFilms/pantoraya/releases/latest).
2. Open the DMG and drag Pantoraya into Applications.
3. On first launch, macOS may request access to Desktop, Documents, and Downloads so Pantoraya can read files, create thumbnails, and save conversions.

Current community builds are not notarized. If macOS blocks the first launch, right-click Pantoraya and choose **Open**.

## Privacy

Pantoraya does not upload files or require an internet connection. Conversion, metadata inspection, thumbnails, and size estimates happen locally. The app does not include accounts, analytics, or advertising.

## Development

```bash
npm install
npm start
```

Create an Apple Silicon DMG:

```bash
npm run build
```

The installer is written to `dist/`.

## Technology

- Electron
- FFmpeg
- H.264 and AAC for MP4
- LAME MP3
- MJPEG for JPG output

## Contributing

Issues and pull requests are welcome. Please describe the input format, selected mode, macOS version, and expected result when reporting conversion problems.

## License

Pantoraya is released under the [MIT License](LICENSE).
