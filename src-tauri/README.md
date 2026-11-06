# Pantoraya · Rust + Tauri 2

Esta carpeta contiene el backend actual de Pantoraya en **Rust + Tauri 2** y reutiliza la interfaz HTML/CSS/JavaScript. La implementación anterior de Electron se conserva para compatibilidad.

## Cómo ejecutarlo

Desde la raíz, con Rust estable y los requisitos de Tauri instalados:

```bash
npm ci
npm run prepare:engines
npm start
npm test
npm run build
```

El bundle macOS usa automáticamente `tauri.macos.conf.json`. Los artefactos se generan en `src-tauri/target/release/bundle/`. `npm run start:electron` abre la implementación anterior.

## FFmpeg

El backend usa el mismo binario que la app Electron. En macOS el bundle incluye el FFmpeg
estático de 22 MB (el mismo que genera `npm run build:ffmpeg`) mediante
`src-tauri/tauri.macos.conf.json`:

```json
{
  "bundle": {
    "resources": {
      "../build/ffmpeg/ffmpeg": "ffmpeg/ffmpeg",
      "../build/licenses": "licenses",
      "../THIRD_PARTY_NOTICES.md": "THIRD_PARTY_NOTICES.md"
    }
  }
}
```

Antes de compilar hay que colocar el binario en `build/ffmpeg/ffmpeg`. Se puede generar
desde cero con `npm run build:ffmpeg` (compila FFmpeg, x264 y LAME; tarda bastante) o
copiar uno ya verificado. El orden de búsqueda en tiempo de ejecución es:

1. `resources/ffmpeg/ffmpeg` dentro del bundle.
2. `build/ffmpeg/ffmpeg` en desarrollo.
3. `build/windows/ffmpeg.exe` en Windows.
4. `/opt/homebrew/bin/ffmpeg`, `/usr/local/bin/ffmpeg` o `/usr/bin/ffmpeg`.

En Linux se usan `/usr/bin/ffmpeg` y `/usr/local/bin/ffmpeg`, igual que en Electron.
Windows y Linux necesitarían su propio `tauri.windows.conf.json` / `tauri.linux.conf.json`
para empaquetar el binario correspondiente.

FFmpeg sigue ejecutándose como **proceso separado**. No se enlaza estáticamente con la
app, así que la licencia MIT de Pantoraya no queda contaminada por la GPL de FFmpeg/x264.

## Qué está portado

| Área | Estado |
| --- | --- |
| Ventana fija 410×400 y barra de arrastre | ✅ |
| Selección de archivos y filtros | ✅ |
| Detección de tipo, tamaño, duración y dimensiones | ✅ |
| Miniaturas (FFmpeg en todas las plataformas) | ✅ |
| Conversión MP4 / MP3 / JPG con los mismos argumentos | ✅ |
| Progreso en tiempo real y cancelación | ✅ |
| Subtítulos SRT en MP4 | ✅ |
| Carpeta de salida (misma carpeta / elegir carpeta) | ✅ |
| Drag & drop de archivos y de subtítulos | ✅ |
| Sonido al terminar | ✅ |
| Temas e idioma del renderer | ✅ |
| Menú nativo y About | ✅ |
| Permisos TCC de macOS | ✅ |
| FFmpeg empaquetado y usado desde el bundle | ✅ |
| Firma / notarización | ⏳ pendiente |

## Resultados medidos

Mediciones reales en un Mac Apple Silicon con macOS 26, compilando en release:

| Artefacto | Electron | Tauri 2 | Diferencia |
| --- | --- | --- | --- |
| DMG | ≈ 136 MB | **13,4 MB** | −90 % |
| App descomprimida | ≈ 318 MB | **28,9 MB** | −91 % |
| App sin FFmpeg | — | **5,0 MB** | — |
| RAM en reposo (Σ procesos) | ≈ 367 MB | ≈ 183 MB | −50 % |

El DMG de Tauri incluye el mismo FFmpeg estático de 22 MB que la versión Electron. Sin
él, la app ocupa 5 MB y el DMG 2,7 MB. La mayor parte de la reducción viene de eliminar
Chromium/Node: Tauri usa el WebView del sistema (WKWebView en macOS).

La RAM de Tauri se reparte entre el proceso principal (~98 MB) y los procesos de WebKit
(GPU, Networking y WebContent, ~87 MB). Electron usa cuatro procesos propios (main, GPU,
network y renderer) que suman ~367 MB.

## Diferencias conocidas

- Las miniaturas se generan con FFmpeg en macOS en lugar de QuickLook. Ya era así
  en Linux; el resultado es consistente entre plataformas, pero ligeramente distinto.
- `trafficLightPosition` de Electron no tiene equivalente directo en la configuración
  de Tauri; los semáforos usan la posición del `titleBarStyle: Overlay`.
- El CSP de Tauri queda desactivado en la configuración actual (`csp: null`). El HTML mantiene su
  propio CSP con `connect-src` para IPC. En producción conviene fijar una política
  estricta y revisar las capacidades.
- El drag & drop usa los eventos nativos de Tauri (`tauri://drag-drop`) en lugar de
  `dataTransfer.files`. El puente decide si el drop va a la zona principal o a la
  zona de subtítulos según la posición del cursor.
- El menú se reconstruye al cambiar de idioma, pero no incluye roles específicos de
  Windows/Linux (por ejemplo, un menú «Archivo» separado).
- La app release no está firmada ni notarizada; macOS la abre con clic derecho →
  Abrir. Los instaladores comunitarios anteriores tampoco garantizan firma o notarización.

## Siguientes pasos para una migración completa

1. Firma y notarización (Developer ID + `notarytool`) y actualización automática con
   `tauri-plugin-updater` si se quiere paridad con el instalador actual.
2. Configs por plataforma para Windows (ShareX FFmpeg) y Linux (dependencia `ffmpeg`),
   más probar el instalador NSIS y el `.deb`.
3. Endurecer CSP y reducir capacidades al mínimo necesario.
4. Ampliar las pruebas del renderer y añadir CI para las tres plataformas.
   `npm test` ya ejecuta las pruebas Rust.
5. Revisar el menú nativo y los permisos TCC en una app firmada.

## Verificación local (6 de noviembre de 2026)

- macOS Apple Silicon: apertura de la app Tauri y conversión PNG → JPG verificadas.
- `npm run check`, seis pruebas Rust y Clippy con `-D warnings`: correctos.
- Build de app y DMG con FFmpeg incluido: correcto.
- Windows/Linux: no ejecutados en esta revisión.
- `npm audit --omit=dev`: sin vulnerabilidades. La cadena de herramientas de desarrollo heredada de Electron conserva 14 avisos (6 moderados y 8 altos); requiere actualización antes de volver a distribuir esa implementación.
