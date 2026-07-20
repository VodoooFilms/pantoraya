<p align="center">
  <img src="assets/icons/icon.png" width="112" alt="Ícono de Pantoraya">
</p>

<h1 align="center">Pantoraya</h1>

<p align="center">
  Conversión privada de archivos multimedia para macOS.<br>
  Video, audio e imágenes — procesados localmente, nunca subidos.
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="https://github.com/VodoooFilms/pantoraya/releases/latest">Descargar</a> ·
  <a href="LICENSE">Licencia MIT</a>
</p>

## ¿Qué es Pantoraya?

Pantoraya es un conversor multimedia pequeño, gratuito y de código abierto diseñado para macOS. Arrastra un archivo y la aplicación seleccionará automáticamente el espacio correcto: MP4 para video, MP3 para audio o JPG para imágenes.

La aplicación mantiene un enfoque deliberadamente sencillo. No hay cuentas, suscripciones, cargas a la nube, publicidad ni paneles complicados. FFmpeg trabaja completamente en tu Mac y cada resultado se guarda junto al archivo original.

## Funciones principales

- Detección automática de video, audio e imágenes
- Conversión MP4 en alta calidad o versión liviana de hasta 720p
- Conversión MP3 y extracción de audio desde video a 320 o 128 kbps
- Compresión JPG conservando dimensiones o reduciendo a un máximo de 1280 px
- Estimación del peso final antes de convertir
- Miniaturas proporcionales, sin deformación
- Progreso en tiempo real y sonido sutil al finalizar
- Temas claro y oscuro
- Interfaz en español e inglés
- Funcionamiento completamente local

## Formatos compatibles

| Espacio | Entrada | Salida | Modos |
| --- | --- | --- | --- |
| MP4 | MOV, MP4, M4V, AVI, MKV, WEBM | MP4 H.264 + AAC | Alta calidad · Liviana 720p |
| MP3 | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, AIFF y archivos de video | MP3 | 320 kbps · 128 kbps |
| JPG | JPG, JPEG, PNG, WEBP, BMP, TIFF | JPG | Dimensiones originales · Liviana 1280 px |

## Descargar e instalar

Pantoraya es compatible actualmente con Macs Apple Silicon que ejecuten macOS 11 o posterior.

1. Descarga el DMG más reciente desde [GitHub Releases](https://github.com/VodoooFilms/pantoraya/releases/latest).
2. Abre el DMG y arrastra Pantoraya a Aplicaciones.
3. En el primer inicio, macOS puede solicitar acceso a Escritorio, Documentos y Descargas para leer archivos, crear miniaturas y guardar conversiones.

Las compilaciones comunitarias actuales no están notarizadas. Si macOS bloquea el primer inicio, haz clic derecho sobre Pantoraya y selecciona **Abrir**.

## Privacidad

Pantoraya no sube archivos ni necesita conexión a internet. La conversión, inspección de metadatos, generación de miniaturas y estimaciones ocurren localmente. La aplicación no incluye cuentas, analítica ni publicidad.

## Desarrollo

```bash
npm install
npm start
```

Para crear un DMG para Apple Silicon:

```bash
npm run build
```

El instalador se genera dentro de `dist/`.

## Tecnología

- Electron
- FFmpeg
- H.264 y AAC para MP4
- LAME MP3
- MJPEG para salida JPG

## Contribuir

Los issues y pull requests son bienvenidos. Al reportar problemas de conversión, incluye el formato de entrada, modo seleccionado, versión de macOS y resultado esperado.

## Licencia

Pantoraya se publica bajo la [Licencia MIT](LICENSE).
