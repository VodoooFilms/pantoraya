# Pantoraya

A minimal, free and open-source MP4 converter for macOS.

Pantoraya converts MOV, MP4, M4V, AVI, MKV and WEBM videos into widely compatible MP4 files. Everything happens locally on your Mac—your videos are never uploaded.

## Features

- Minimal native macOS interface
- Light and dark themes
- Drag and drop
- Real-time conversion progress
- Original-quality and lightweight modes
- H.264 video with AAC audio
- FFmpeg included
- No accounts, subscriptions or internet connection
- Free and open source

## Conversion modes

### Original

Keeps the original video resolution with high-quality H.264 encoding.

### Lightweight

Reduces videos to a maximum of 720p for substantially smaller files.

## Requirements

- macOS 11 or later
- Apple Silicon Mac

## Development

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

The macOS installer will be created inside the `dist` directory.

## Privacy

Pantoraya works completely offline. Video files remain on your Mac and are never transmitted to a server.

## Built with

- Electron
- FFmpeg
- H.264
- AAC

## License

Pantoraya is available under the [MIT License](LICENSE).
