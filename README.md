<p align="center">
  <img src="assets/icons/icon.png" width="112" alt="Pantoraya icon / Ícono de Pantoraya">
</p>

<h1 align="center">Pantoraya</h1>

<p align="center">
  Conversión privada de archivos para macOS · Private file conversion for macOS<br>
  Video, audio, imágenes y PDF procesados localmente · Video, audio, images, and PDFs processed locally
</p>

<p align="center">
  <a href="#español">Español</a> ·
  <a href="#english">English</a> ·
  <a href="https://github.com/VodoooFilms/pantoraya/releases/latest">Descargar / Download</a> ·
  <a href="LICENSE">MIT</a>
</p>

## Español

Pantoraya es un conversor gratuito, pequeño y de código abierto para macOS. Arrastra un archivo y la aplicación seleccionará automáticamente el espacio correcto: MP4 para video, MP3 para audio, JPG para imágenes o PDF para comprimir PDFs y convertir documentos.

Todo se procesa de forma privada en tu Mac. No hay cuentas, suscripciones, publicidad, analítica ni cargas a la nube.

### Funciones

- Conversión MP4 en alta calidad o versión liviana de hasta 720p
- Conversión MP3 y extracción de audio desde video a 320 o 128 kbps
- Compresión JPG conservando las dimensiones o reduciendo a un máximo de 1280 px
- Compresión PDF nativa en alta calidad o versión liviana
- Conversión de DOC, DOCX, TXT, RTF y ODT a PDF
- Detección automática del tipo de archivo
- Miniaturas proporcionales sin deformación
- Peso original y estimación del resultado en MB
- Progreso en tiempo real y sonido sutil al finalizar
- Temas claro y oscuro
- Interfaz completa en español e inglés

### Formatos compatibles

| Espacio | Entrada | Salida | Modos |
| --- | --- | --- | --- |
| MP4 | MOV, MP4, M4V, AVI, MKV, WEBM | MP4 H.264 + AAC | Alta calidad · Liviana 720p |
| MP3 | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, AIFF y video | MP3 | 320 kbps · 128 kbps |
| JPG | JPG, JPEG, PNG, WEBP, BMP, TIFF | JPG | Dimensiones originales · Liviana 1280 px |
| PDF | PDF, DOC, DOCX, TXT, RTF, ODT | PDF optimizado o convertido | Alta calidad · Liviana |

### Instalar

Pantoraya es compatible con Macs Apple Silicon que ejecuten macOS 13.4 o posterior.

1. Descarga el DMG desde [GitHub Releases](https://github.com/VodoooFilms/pantoraya/releases/latest).
2. Abre el DMG y arrastra Pantoraya a Aplicaciones.
3. En el primer inicio, permite el acceso solicitado a Escritorio, Documentos y Descargas.

Las compilaciones comunitarias no están notarizadas. Si macOS bloquea el primer inicio, haz clic derecho sobre Pantoraya y selecciona **Abrir**.

También está disponible una [edición independiente del README en español](README.es.md).

---

## English

Pantoraya is a small, free, open-source file converter for macOS. Drop a file into the app and it automatically chooses the correct workspace: MP4 for video, MP3 for audio, JPG for images, or PDF for PDF compression and document conversion.

Everything is processed privately on your Mac. There are no accounts, subscriptions, ads, analytics, or cloud uploads.

### Features

- High-quality or lightweight 720p MP4 conversion
- MP3 conversion and audio extraction from video at 320 or 128 kbps
- JPG compression at original dimensions or a lightweight 1280 px maximum
- Native PDF compression in high-quality or lightweight mode
- DOC, DOCX, TXT, RTF, and ODT to PDF conversion
- Automatic file-type detection
- Proportional thumbnails without stretching
- Original and estimated output sizes displayed in MB
- Real-time progress and a subtle completion sound
- Light and dark themes
- Complete English and Spanish interface

### Supported formats

| Workspace | Input | Output | Modes |
| --- | --- | --- | --- |
| MP4 | MOV, MP4, M4V, AVI, MKV, WEBM | H.264 + AAC MP4 | High quality · Lightweight 720p |
| MP3 | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, AIFF, and video | MP3 | 320 kbps · 128 kbps |
| JPG | JPG, JPEG, PNG, WEBP, BMP, TIFF | JPG | Original dimensions · Lightweight 1280 px |
| PDF | PDF, DOC, DOCX, TXT, RTF, ODT | Optimized or converted PDF | High quality · Lightweight |

### Install

Pantoraya supports Apple Silicon Macs running macOS 13.4 or later.

1. Download the DMG from [GitHub Releases](https://github.com/VodoooFilms/pantoraya/releases/latest).
2. Open the DMG and drag Pantoraya into Applications.
3. On first launch, allow the requested access to Desktop, Documents, and Downloads.

Community builds are not notarized. If macOS blocks the first launch, right-click Pantoraya and choose **Open**.

---

## Desarrollo / Development

```bash
npm install
npm start
```

Crear el DMG para Apple Silicon / Build the Apple Silicon DMG:

```bash
brew install pkgconf
npm run build
```

Pantoraya compila un motor FFmpeg estático desde fuentes oficiales verificadas por checksum. Las operaciones PDF están separadas en módulos para admitir futuras herramientas de unión, división, rotación y conversión de imágenes.

Pantoraya builds a static FFmpeg engine from checksum-verified upstream sources. PDF operations are modular so future merge, split, rotation, and image-conversion tools can be added cleanly.

## Tecnología / Technology

- Electron
- FFmpeg, x264, LAME
- H.264 + AAC, MP3 and MJPEG
- Apple PDFKit, AppKit and Quick Look

## Contribuir / Contributing

Los issues y pull requests son bienvenidos. Incluye el formato de entrada, modo seleccionado, versión de macOS y resultado esperado.

Issues and pull requests are welcome. Include the input format, selected mode, macOS version, and expected result.

## Licencia / License

El código de Pantoraya está disponible bajo la [licencia MIT](LICENSE). FFmpeg y sus bibliotecas conservan sus licencias GPL/LGPL; consulta los [avisos de terceros](THIRD_PARTY_NOTICES.md).

Pantoraya's application source is available under the [MIT License](LICENSE). FFmpeg and its libraries retain their GPL/LGPL licenses; see the [third-party notices](THIRD_PARTY_NOTICES.md).
