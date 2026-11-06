use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogResult};
use tauri_plugin_opener::OpenerExt;

const VIDEO_EXTENSIONS: &[&str] = &["mov", "mp4", "m4v", "avi", "mkv", "webm"];
const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "wma", "aif", "aiff",
];
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff"];
const SUBTITLE_EXTENSIONS: &[&str] = &["srt"];

// ---------------------------------------------------------------------------
// Localisation (only the strings used by the native layer)
// ---------------------------------------------------------------------------

fn t(lang: &str, key: &str) -> &'static str {
    if lang == "en" {
        en_text(key)
    } else {
        es_text(key)
    }
}

fn es_text(key: &str) -> &'static str {
    match key {
        "about" => "Acerca de Pantoraya",
        "aboutCredit" => "Pantoraya es un conversor gratuito y de código abierto para macOS, Windows y Linux. Convierte video a MP4, extrae y comprime audio en MP3 y optimiza imágenes JPG. Todo ocurre de forma privada y local, sin cuentas, anuncios ni cargas a la nube.",
        "hide" => "Ocultar Pantoraya",
        "hideOthers" => "Ocultar otras",
        "unhide" => "Mostrar todo",
        "quit" => "Salir de Pantoraya",
        "edit" => "Edición",
        "undo" => "Deshacer",
        "redo" => "Rehacer",
        "cut" => "Cortar",
        "copy" => "Copiar",
        "paste" => "Pegar",
        "selectAll" => "Seleccionar todo",
        "window" => "Ventana",
        "minimize" => "Minimizar",
        "zoom" => "Zoom",
        "front" => "Traer todo al frente",
        "selectTitle" => "Selecciona uno o varios archivos",
        "outputFolderTitle" => "Selecciona la carpeta de salida",
        "compatible" => "Archivos compatibles",
        "videos" => "Videos",
        "audio" => "Audio",
        "images" => "Imágenes",
        "unsupported" => "El archivo no tiene un formato compatible.",
        "active" => "Ya hay una conversión en curso.",
        "missing" => "No se encontró un archivo compatible.",
        "invalidProfile" => "Perfil de compresión no válido.",
        "ffmpegMissing" => "Pantoraya no encontró su motor FFmpeg. Reinstala la aplicación.",
        "quality" => "Alta calidad",
        "light" => "Liviana",
        "converting" => "Convirtiendo",
        "startError" => "No se pudo iniciar FFmpeg",
        "cancelled" => "Conversión cancelada.",
        "ffmpegExit" => "FFmpeg terminó con código",
        "sameFolder" => "Misma carpeta",
        "chooseFolder" => "Elegir carpeta…",
        "cancel" => "Cancelar",
        "whereSaveTitle" => "Carpeta de salida",
        "whereSaveMessage" => "¿Dónde guardar las conversiones?",
        "whereSaveDetail" => "Puedes guardarlas junto a los originales o elegir otra carpeta.",
        "selectSubtitles" => "Selecciona subtítulos SRT",
        _ => "",
    }
}

fn en_text(key: &str) -> &'static str {
    match key {
        "about" => "About Pantoraya",
        "aboutCredit" => "Pantoraya is a free, open-source converter for macOS, Windows and Linux. It converts video to MP4, extracts and compresses audio as MP3, and optimizes JPG images. Everything happens privately and locally, with no accounts, ads, or cloud uploads.",
        "hide" => "Hide Pantoraya",
        "hideOthers" => "Hide Others",
        "unhide" => "Show All",
        "quit" => "Quit Pantoraya",
        "edit" => "Edit",
        "undo" => "Undo",
        "redo" => "Redo",
        "cut" => "Cut",
        "copy" => "Copy",
        "paste" => "Paste",
        "selectAll" => "Select All",
        "window" => "Window",
        "minimize" => "Minimize",
        "zoom" => "Zoom",
        "front" => "Bring All to Front",
        "selectTitle" => "Select one or more files",
        "outputFolderTitle" => "Select the output folder",
        "compatible" => "Compatible files",
        "videos" => "Videos",
        "audio" => "Audio",
        "images" => "Images",
        "unsupported" => "The file format is not supported.",
        "active" => "A conversion is already in progress.",
        "missing" => "No compatible file was found.",
        "invalidProfile" => "Invalid compression profile.",
        "ffmpegMissing" => "Pantoraya could not find its FFmpeg engine. Reinstall the application.",
        "quality" => "High quality",
        "light" => "Lightweight",
        "converting" => "Converting",
        "startError" => "Could not start FFmpeg",
        "cancelled" => "Conversion cancelled.",
        "ffmpegExit" => "FFmpeg exited with code",
        "sameFolder" => "Same folder",
        "chooseFolder" => "Choose folder…",
        "cancel" => "Cancel",
        "whereSaveTitle" => "Output folder",
        "whereSaveMessage" => "Where should conversions be saved?",
        "whereSaveDetail" => "Save them next to the originals or choose another folder.",
        "selectSubtitles" => "Select SRT subtitles",
        _ => "",
    }
}

// ---------------------------------------------------------------------------
// Files, media types and FFmpeg argument construction
// ---------------------------------------------------------------------------

fn ext_lower(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn has_extension(path: &Path, extensions: &[&str]) -> bool {
    let extension = ext_lower(path);
    extensions.contains(&extension.as_str())
}

fn media_type_for(path: &Path) -> Option<&'static str> {
    if has_extension(path, VIDEO_EXTENSIONS) {
        Some("video")
    } else if has_extension(path, AUDIO_EXTENSIONS) {
        Some("audio")
    } else if has_extension(path, IMAGE_EXTENSIONS) {
        Some("image")
    } else {
        None
    }
}

fn is_supported_input(path: &Path, converter_id: &str) -> bool {
    match converter_id {
        "mp4" => has_extension(path, VIDEO_EXTENSIONS),
        "mp3" => has_extension(path, VIDEO_EXTENSIONS) || has_extension(path, AUDIO_EXTENSIONS),
        "jpg" => has_extension(path, IMAGE_EXTENSIONS),
        _ => false,
    }
}

fn output_args(converter_id: &str) -> &'static [&'static str] {
    match converter_id {
        "mp4" => &["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
        "mp3" => &["-map_metadata", "0", "-id3v2_version", "3"],
        "jpg" => &["-frames:v", "1", "-update", "1", "-map_metadata", "0"],
        _ => &[],
    }
}

/// Returns the encoder arguments plus the output suffix in Spanish and English.
fn profile_args(
    converter_id: &str,
    profile_id: &str,
) -> Option<(&'static [&'static str], &'static str, &'static str)> {
    match (converter_id, profile_id) {
        ("mp4", "quality") => Some((
            &[
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a",
                "192k",
            ],
            "",
            "",
        )),
        ("mp4", "light") => Some((
            &[
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "27",
                "-vf",
                r"scale=w=min(1280\,iw):h=min(720\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
            ],
            "_liviano",
            "_light",
        )),
        ("mp3", "high") => Some((
            &["-c:a", "libmp3lame", "-b:a", "320k"],
            "_mp3",
            "_mp3",
        )),
        ("mp3", "light") => Some((
            &["-c:a", "libmp3lame", "-b:a", "128k"],
            "_mp3-liviano",
            "_mp3-light",
        )),
        ("jpg", "high") => Some((
            &[
                "-filter_complex",
                "[0:v]format=rgba[fg];color=c=white:s=16x16[bg];[bg][fg]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,format=yuvj420p[v]",
                "-map",
                "[v]",
                "-c:v",
                "mjpeg",
                "-q:v",
                "2",
            ],
            "_comprimida",
            "_compressed",
        )),
        ("jpg", "light") => Some((
            &[
                "-filter_complex",
                r"[0:v]scale=w=min(1280\,iw):h=min(1280\,ih):force_original_aspect_ratio=decrease,format=rgba[fg];color=c=white:s=16x16[bg];[bg][fg]scale2ref[bg][fg];[bg][fg]overlay=shortest=1,format=yuvj420p[v]",
                "-map",
                "[v]",
                "-c:v",
                "mjpeg",
                "-q:v",
                "7",
            ],
            "_liviana",
            "_light",
        )),
        _ => None,
    }
}

fn ffmpeg_path(app: &AppHandle) -> Option<PathBuf> {
    let executable = if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let mut candidates: Vec<PathBuf> = Vec::new();

    if cfg!(target_os = "linux") {
        candidates.push(PathBuf::from("/usr/bin/ffmpeg"));
        candidates.push(PathBuf::from("/usr/local/bin/ffmpeg"));
    } else {
        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(resource_dir.join("ffmpeg").join(executable));
        }
        if cfg!(debug_assertions) {
            let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            candidates.push(manifest.join("../build/ffmpeg").join(executable));
            if cfg!(windows) {
                candidates.push(manifest.join("../build/windows/ffmpeg.exe"));
            }
        }
        candidates.push(PathBuf::from("/opt/homebrew/bin/ffmpeg"));
        candidates.push(PathBuf::from("/usr/local/bin/ffmpeg"));
        candidates.push(PathBuf::from("/usr/bin/ffmpeg"));
    }

    candidates.into_iter().find(|candidate| candidate.is_file())
}

fn unique_output_path(
    input_path: &Path,
    converter_id: &str,
    suffix_es: &str,
    suffix_en: &str,
    language: &str,
    output_directory: Option<&str>,
) -> PathBuf {
    let directory = output_directory
        .map(PathBuf::from)
        .or_else(|| input_path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = input_path
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let output_extension = match converter_id {
        "mp4" => ".mp4",
        "mp3" => ".mp3",
        _ => ".jpg",
    };
    let same_extension = format!(".{}", ext_lower(input_path)) == output_extension;
    let suffix = if same_extension {
        ""
    } else if language == "es" {
        suffix_es
    } else {
        suffix_en
    };

    let mut candidate = directory.join(format!("{stem}{suffix}{output_extension}"));
    let mut count = 2_u32;
    while candidate.exists() {
        candidate = directory.join(format!("{stem}{suffix}-{count}{output_extension}"));
        count += 1;
    }
    candidate
}

fn build_args(
    input_path: &Path,
    converter_id: &str,
    profile: &[&str],
    subtitle_path: &Option<String>,
    output_path: &Path,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-y".into(),
        "-i".into(),
        input_path.to_string_lossy().into_owned(),
    ];

    if let Some(subtitle) = subtitle_path {
        args.push("-i".into());
        args.push(subtitle.clone());
    }

    if converter_id == "mp3" {
        if has_extension(input_path, VIDEO_EXTENSIONS) {
            args.push("-vn".into());
        } else {
            args.extend(
                [
                    "-map",
                    "0:a:0",
                    "-map",
                    "0:v?",
                    "-c:v",
                    "copy",
                    "-disposition:v",
                    "attached_pic",
                ]
                .iter()
                .map(|value| (*value).to_string()),
            );
        }
    } else if subtitle_path.is_some() {
        args.extend(
            [
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-map",
                "1:0",
                "-c:s",
                "mov_text",
                "-metadata:s:s:0",
                "language=und",
            ]
            .iter()
            .map(|value| (*value).to_string()),
        );
    }

    args.extend(profile.iter().map(|value| (*value).to_string()));
    args.extend(
        output_args(converter_id)
            .iter()
            .map(|value| (*value).to_string()),
    );
    args.push(output_path.to_string_lossy().into_owned());
    args
}

// ---------------------------------------------------------------------------
// Probing and thumbnails
// ---------------------------------------------------------------------------

#[derive(Default)]
struct MediaInfo {
    duration: f64,
    width: u32,
    height: u32,
}

fn parse_timestamp(value: &str) -> f64 {
    let mut parts = value.trim().split(':');
    let hours = parts
        .next()
        .and_then(|part| part.parse::<f64>().ok())
        .unwrap_or(0.0);
    let minutes = parts
        .next()
        .and_then(|part| part.parse::<f64>().ok())
        .unwrap_or(0.0);
    let seconds = parts
        .next()
        .and_then(|part| part.parse::<f64>().ok())
        .unwrap_or(0.0);
    hours * 3600.0 + minutes * 60.0 + seconds
}

fn extract_after<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let index = text.find(key)?;
    let rest = text[index + key.len()..].trim_start();
    let end = rest
        .find(|character: char| character == ',' || character.is_whitespace())
        .unwrap_or(rest.len());
    Some(&rest[..end])
}

fn probe_file(ffmpeg: &Path, file_path: &Path) -> MediaInfo {
    let Ok(output) = Command::new(ffmpeg)
        .args(["-hide_banner", "-i"])
        .arg(file_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
    else {
        return MediaInfo::default();
    };

    let stderr = String::from_utf8_lossy(&output.stderr);
    let duration = extract_after(&stderr, "Duration:")
        .map(parse_timestamp)
        .unwrap_or(0.0);
    let mut width = 0;
    let mut height = 0;

    if let Some(line) = stderr.lines().find(|line| line.contains("Video:")) {
        let bytes = line.as_bytes();
        let mut index = 0;
        while index + 2 < bytes.len() {
            if bytes[index].is_ascii_digit() {
                let width_start = index;
                while index < bytes.len() && bytes[index].is_ascii_digit() {
                    index += 1;
                }
                if index < bytes.len() && bytes[index] == b'x' {
                    let width_candidate = line[width_start..index].parse::<u32>().unwrap_or(0);
                    let height_start = index + 1;
                    let mut height_end = height_start;
                    while height_end < bytes.len() && bytes[height_end].is_ascii_digit() {
                        height_end += 1;
                    }
                    if height_end > height_start {
                        let height_candidate =
                            line[height_start..height_end].parse::<u32>().unwrap_or(0);
                        if width_candidate >= 10 && height_candidate >= 10 {
                            width = width_candidate;
                            height = height_candidate;
                            break;
                        }
                    }
                }
            }
            index += 1;
        }
    }

    MediaInfo {
        duration,
        width,
        height,
    }
}

fn fitted_thumbnail_size(width: u32, height: u32) -> (u32, u32) {
    if width == 0 || height == 0 {
        return (252, 252);
    }
    let scale = (732.0 / f64::from(width)).min(252.0 / f64::from(height));
    (
        ((f64::from(width) * scale).round() as u32).max(1),
        ((f64::from(height) * scale).round() as u32).max(1),
    )
}

fn thumbnail_for_file(ffmpeg: &Path, file_path: &Path, media: &MediaInfo) -> Option<String> {
    let (width, height) = fitted_thumbnail_size(media.width, media.height);
    let filter = format!("scale={width}:{height}:force_original_aspect_ratio=decrease");
    let mut child = Command::new(ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-i"])
        .arg(file_path)
        .args([
            "-frames:v",
            "1",
            "-vf",
            &filter,
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    let mut stdout = child.stdout.take()?;
    let reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut chunk = [0_u8; 8192];
        while bytes.len() < 8 * 1024 * 1024 {
            match stdout.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(read) => bytes.extend_from_slice(&chunk[..read]),
            }
        }
        bytes
    });

    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if started.elapsed() > Duration::from_secs(3) {
                    let _ = child.kill();
                    break;
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(_) => break,
        }
    }

    let bytes = reader.join().unwrap_or_default();
    if bytes.is_empty() {
        None
    } else {
        Some(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileDetails {
    path: String,
    name: String,
    size: u64,
    media_type: Option<&'static str>,
    thumbnail: Option<String>,
    duration: f64,
    width: u32,
    height: u32,
}

fn file_details(ffmpeg: &Path, file_path: &Path) -> Result<FileDetails, String> {
    let metadata = fs::metadata(file_path).map_err(|error| error.to_string())?;
    let media = probe_file(ffmpeg, file_path);
    let thumbnail = thumbnail_for_file(ffmpeg, file_path, &media);
    Ok(FileDetails {
        path: file_path.to_string_lossy().into_owned(),
        name: file_path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default(),
        size: metadata.len(),
        media_type: media_type_for(file_path),
        thumbnail,
        duration: media.duration,
        width: media.width,
        height: media.height,
    })
}

fn file_details_for_paths(ffmpeg: &Path, paths: Vec<PathBuf>) -> Vec<Result<FileDetails, String>> {
    let count = paths.len();
    if count == 0 {
        return Vec::new();
    }

    let next = std::sync::atomic::AtomicUsize::new(0);
    let results: Mutex<Vec<Option<Result<FileDetails, String>>>> =
        Mutex::new((0..count).map(|_| None).collect());
    let workers = count.min(4);

    std::thread::scope(|scope| {
        for _ in 0..workers {
            scope.spawn(|| loop {
                let index = next.fetch_add(1, Ordering::SeqCst);
                if index >= count {
                    break;
                }
                let value = file_details(ffmpeg, &paths[index]);
                results.lock().unwrap()[index] = Some(value);
            });
        }
    });

    results
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|value| value.expect("thumbnail worker result"))
        .collect()
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

struct AppState {
    language: Arc<Mutex<String>>,
    active_pid: Arc<Mutex<Option<u32>>>,
    cancelled: Arc<AtomicBool>,
}

impl AppState {
    fn new() -> Self {
        Self {
            language: Arc::new(Mutex::new("es".to_string())),
            active_pid: Arc::new(Mutex::new(None)),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    fn language(&self) -> String {
        self.language
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| "es".to_string())
    }
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    percent: u32,
    timemark: String,
}

#[derive(Serialize, Clone)]
struct StatusPayload {
    status: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConvertResult {
    success: bool,
    output_path: String,
    output_bytes: u64,
    input_bytes: u64,
    converter_id: String,
    profile_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputChoice {
    canceled: bool,
    path: Option<String>,
}

#[derive(Serialize)]
struct SubtitleFile {
    path: String,
    name: String,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ConvertOptions {
    output_directory: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn select_files(
    app: AppHandle,
    state: State<'_, AppState>,
    converter_id: Option<String>,
) -> Result<Vec<FileDetails>, String> {
    let language = state.language();
    let ffmpeg = ffmpeg_path(&app).ok_or_else(|| t(&language, "ffmpegMissing").to_string())?;

    let mut extensions: Vec<&str> = Vec::new();
    match converter_id.as_deref() {
        Some("mp4") => extensions.extend_from_slice(VIDEO_EXTENSIONS),
        Some("mp3") => {
            extensions.extend_from_slice(VIDEO_EXTENSIONS);
            extensions.extend_from_slice(AUDIO_EXTENSIONS);
        }
        Some("jpg") => extensions.extend_from_slice(IMAGE_EXTENSIONS),
        _ => {
            extensions.extend_from_slice(VIDEO_EXTENSIONS);
            extensions.extend_from_slice(AUDIO_EXTENSIONS);
            extensions.extend_from_slice(IMAGE_EXTENSIONS);
        }
    }

    let Some(files) = app
        .dialog()
        .file()
        .set_title(t(&language, "selectTitle"))
        .add_filter(t(&language, "compatible"), &extensions)
        .add_filter(t(&language, "videos"), VIDEO_EXTENSIONS)
        .add_filter(t(&language, "audio"), AUDIO_EXTENSIONS)
        .add_filter(t(&language, "images"), IMAGE_EXTENSIONS)
        .blocking_pick_files()
    else {
        return Ok(Vec::new());
    };

    let paths: Vec<PathBuf> = files
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .filter(|path| match converter_id.as_deref() {
            Some(id) => is_supported_input(path, id),
            None => media_type_for(path).is_some(),
        })
        .collect();

    Ok(file_details_for_paths(&ffmpeg, paths)
        .into_iter()
        .filter_map(|value| value.ok())
        .collect())
}

#[tauri::command]
async fn choose_output_location(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<OutputChoice, String> {
    let language = state.language();
    let same_folder = t(&language, "sameFolder");
    let choose_folder = t(&language, "chooseFolder");
    let cancel = t(&language, "cancel");

    let result = app
        .dialog()
        .message(t(&language, "whereSaveMessage"))
        .title(t(&language, "whereSaveTitle"))
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            same_folder.to_string(),
            choose_folder.to_string(),
            cancel.to_string(),
        ))
        .blocking_show_with_result();

    let wants_same_folder = matches!(&result, MessageDialogResult::Custom(label) if label == same_folder)
        || matches!(&result, MessageDialogResult::Yes);
    let wants_folder = matches!(&result, MessageDialogResult::Custom(label) if label == choose_folder)
        || matches!(&result, MessageDialogResult::No);

    if wants_same_folder {
        return Ok(OutputChoice {
            canceled: false,
            path: None,
        });
    }
    if !wants_folder {
        return Ok(OutputChoice {
            canceled: true,
            path: None,
        });
    }

    let folder = app
        .dialog()
        .file()
        .set_title(t(&language, "outputFolderTitle"))
        .blocking_pick_folder()
        .and_then(|file| file.into_path().ok());

    Ok(match folder {
        Some(path) => OutputChoice {
            canceled: false,
            path: Some(path.to_string_lossy().into_owned()),
        },
        None => OutputChoice {
            canceled: true,
            path: None,
        },
    })
}

#[tauri::command]
async fn select_subtitle(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<SubtitleFile>, String> {
    let language = state.language();
    let file = app
        .dialog()
        .file()
        .set_title(t(&language, "selectSubtitles"))
        .add_filter("SubRip", SUBTITLE_EXTENSIONS)
        .blocking_pick_file()
        .and_then(|value| value.into_path().ok());

    Ok(file.map(|path| SubtitleFile {
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
    }))
}

#[tauri::command]
async fn inspect_file(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
) -> Result<FileDetails, String> {
    let language = state.language();
    let path = PathBuf::from(file_path);
    if media_type_for(&path).is_none() || !path.is_file() {
        return Err(t(&language, "unsupported").to_string());
    }
    let ffmpeg = ffmpeg_path(&app).ok_or_else(|| t(&language, "ffmpegMissing").to_string())?;

    tauri::async_runtime::spawn_blocking(move || file_details(&ffmpeg, &path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn inspect_files(
    app: AppHandle,
    state: State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<Vec<FileDetails>, String> {
    let language = state.language();
    if file_paths.is_empty()
        || file_paths.iter().any(|file_path| {
            let path = PathBuf::from(file_path);
            media_type_for(&path).is_none() || !path.is_file()
        })
    {
        return Err(t(&language, "unsupported").to_string());
    }
    let ffmpeg = ffmpeg_path(&app).ok_or_else(|| t(&language, "ffmpegMissing").to_string())?;
    let paths: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();

    let results =
        tauri::async_runtime::spawn_blocking(move || file_details_for_paths(&ffmpeg, paths))
            .await
            .map_err(|error| error.to_string())?;

    Ok(results.into_iter().filter_map(|value| value.ok()).collect())
}

#[tauri::command]
async fn inspect_subtitle(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<SubtitleFile, String> {
    let path = PathBuf::from(file_path);
    if !has_extension(&path, SUBTITLE_EXTENSIONS) || !path.is_file() {
        return Err(t(&state.language(), "unsupported").to_string());
    }
    Ok(SubtitleFile {
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
async fn convert_media(
    app: AppHandle,
    state: State<'_, AppState>,
    input_path: String,
    converter_id: String,
    profile_id: String,
    subtitle_path: Option<String>,
    options: Option<ConvertOptions>,
) -> Result<ConvertResult, String> {
    let language = state.language();
    let converter_id = converter_id.to_ascii_lowercase();
    let input_path = PathBuf::from(input_path);

    if !is_supported_input(&input_path, &converter_id) || !input_path.is_file() {
        return Err(t(&language, "missing").to_string());
    }

    let (profile, suffix_es, suffix_en) = profile_args(&converter_id, &profile_id)
        .ok_or_else(|| t(&language, "invalidProfile").to_string())?;

    if let Some(subtitle) = subtitle_path.as_deref() {
        let subtitle = PathBuf::from(subtitle);
        if converter_id != "mp4"
            || !has_extension(&subtitle, SUBTITLE_EXTENSIONS)
            || !subtitle.is_file()
        {
            return Err(t(&language, "unsupported").to_string());
        }
    }

    let ffmpeg = ffmpeg_path(&app).ok_or_else(|| t(&language, "ffmpegMissing").to_string())?;
    let output_directory = options
        .as_ref()
        .and_then(|value| value.output_directory.clone())
        .filter(|directory| Path::new(directory).is_dir());
    let output_path = unique_output_path(
        &input_path,
        &converter_id,
        suffix_es,
        suffix_en,
        &language,
        output_directory.as_deref(),
    );
    let input_bytes = fs::metadata(&input_path)
        .map(|meta| meta.len())
        .unwrap_or(0);
    let subtitle_path = subtitle_path.filter(|value| !value.is_empty());
    let args = build_args(
        &input_path,
        &converter_id,
        profile,
        &subtitle_path,
        &output_path,
    );

    let active_pid = state.active_pid.clone();
    let cancelled = state.cancelled.clone();
    let app_for_task = app.clone();
    let language_for_task = language.clone();
    let converter_for_task = converter_id.clone();
    let profile_for_task = profile_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        run_conversion(
            app_for_task,
            ffmpeg,
            args,
            output_path,
            input_bytes,
            converter_for_task,
            profile_for_task,
            language_for_task,
            active_pid,
            cancelled,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[allow(clippy::too_many_arguments)]
fn run_conversion(
    app: AppHandle,
    ffmpeg: PathBuf,
    args: Vec<String>,
    output_path: PathBuf,
    input_bytes: u64,
    converter_id: String,
    profile_id: String,
    language: String,
    active_pid: Arc<Mutex<Option<u32>>>,
    cancelled: Arc<AtomicBool>,
) -> Result<ConvertResult, String> {
    let mut active_guard = active_pid.lock().unwrap();
    if active_guard.is_some() {
        return Err(t(&language, "active").to_string());
    }
    cancelled.store(false, Ordering::SeqCst);

    let mut child = Command::new(&ffmpeg)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("{}: {error}", t(&language, "startError")))?;
    *active_guard = Some(child.id());
    drop(active_guard);

    let label_key = if profile_id == "quality" || profile_id == "high" {
        "quality"
    } else {
        "light"
    };
    let _ = app.emit(
        "conversion-status",
        StatusPayload {
            status: "starting".to_string(),
            message: format!(
                "{} · {}…",
                t(&language, "converting"),
                t(&language, label_key)
            ),
        },
    );

    let stderr_tail: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let progress_thread = child.stderr.take().map(|stderr| {
        let app = app.clone();
        let tail = stderr_tail.clone();
        thread::spawn(move || {
            let mut reader = std::io::BufReader::new(stderr);
            let mut buffer = [0_u8; 4096];
            let mut pending = String::new();
            let mut duration = 0.0_f64;

            loop {
                let read = match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(read) => read,
                };
                pending.push_str(&String::from_utf8_lossy(&buffer[..read]));

                while let Some(position) = pending.find(['\n', '\r']) {
                    let line: String = pending[..position].to_string();
                    pending.drain(..=position);
                    if line.trim().is_empty() {
                        continue;
                    }

                    {
                        let mut tail = tail.lock().unwrap();
                        tail.push_back(line.clone());
                        if tail.len() > 200 {
                            tail.pop_front();
                        }
                    }

                    if line.contains("Duration:") {
                        if let Some(value) = extract_after(&line, "Duration:") {
                            duration = parse_timestamp(value);
                        }
                    }

                    if line.contains("time=") {
                        if let Some(value) = extract_after(&line, "time=") {
                            let current = parse_timestamp(value);
                            if duration > 0.0 {
                                let percent =
                                    ((current / duration) * 100.0).round().clamp(0.0, 99.0) as u32;
                                let _ = app.emit(
                                    "conversion-progress",
                                    ProgressPayload {
                                        percent,
                                        timemark: value.trim().to_string(),
                                    },
                                );
                            }
                        }
                    }
                }
            }
        })
    });

    let status = child.wait();
    if let Some(handle) = progress_thread {
        let _ = handle.join();
    }
    *active_pid.lock().unwrap() = None;

    let status = status.map_err(|error| error.to_string())?;

    if cancelled.load(Ordering::SeqCst) {
        let _ = fs::remove_file(&output_path);
        return Err(t(&language, "cancelled").to_string());
    }

    if !status.success() {
        let _ = fs::remove_file(&output_path);
        let detail = {
            let tail = stderr_tail.lock().unwrap();
            let mut lines: Vec<&str> = tail
                .iter()
                .rev()
                .filter(|line| !line.trim().is_empty())
                .take(3)
                .map(String::as_str)
                .collect();
            lines.reverse();
            lines.join(" ")
        };
        return Err(if detail.is_empty() {
            format!(
                "{} {}.",
                t(&language, "ffmpegExit"),
                status.code().unwrap_or(-1)
            )
        } else {
            detail
        });
    }

    let output_bytes = fs::metadata(&output_path)
        .map(|meta| meta.len())
        .unwrap_or(0);
    let _ = app.emit(
        "conversion-progress",
        ProgressPayload {
            percent: 100,
            timemark: String::new(),
        },
    );
    play_completion_sound();

    Ok(ConvertResult {
        success: true,
        output_path: output_path.to_string_lossy().into_owned(),
        output_bytes,
        input_bytes,
        converter_id,
        profile_id,
    })
}

#[tauri::command]
async fn cancel_conversion(state: State<'_, AppState>) -> Result<bool, String> {
    let pid = *state.active_pid.lock().unwrap();
    match pid {
        Some(pid) => {
            state.cancelled.store(true, Ordering::SeqCst);
            kill_pid(pid);
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
async fn show_in_folder(app: AppHandle, file_path: String) -> Result<(), String> {
    if Path::new(&file_path).exists() {
        app.opener()
            .reveal_item_in_dir(&file_path)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn set_language(
    app: AppHandle,
    state: State<'_, AppState>,
    language: String,
) -> Result<bool, String> {
    if language != "es" && language != "en" {
        return Ok(false);
    }
    *state.language.lock().unwrap() = language.clone();
    let _ = build_menu(&app, &language);
    Ok(true)
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

#[cfg(unix)]
fn kill_pid(pid: u32) {
    unsafe {
        libc::kill(pid as i32, libc::SIGTERM);
    }
}

#[cfg(windows)]
fn kill_pid(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output();
}

#[cfg(not(any(unix, windows)))]
fn kill_pid(_pid: u32) {}

fn play_completion_sound() {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[System.Media.SystemSounds]::Asterisk.Play()",
            ])
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        if Path::new("/usr/bin/canberra-gtk-play").exists() {
            let _ = Command::new("/usr/bin/canberra-gtk-play")
                .args(["-i", "complete", "-V", "-9.0"])
                .spawn();
        }
    }

    #[cfg(target_os = "macos")]
    {
        let sound_path = "/System/Library/Sounds/Tink.aiff";
        if Path::new(sound_path).exists() {
            let _ = Command::new("/usr/bin/afplay")
                .args(["-v", "0.35", sound_path])
                .spawn();
        }
    }
}

fn request_initial_folder_permissions(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        for path in [
            app.path().desktop_dir(),
            app.path().document_dir(),
            app.path().download_dir(),
        ]
        .into_iter()
        .flatten()
        {
            if let Ok(entries) = fs::read_dir(path) {
                let _ = entries.count();
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

fn build_menu(app: &AppHandle, language: &str) -> tauri::Result<()> {
    use tauri::menu::{AboutMetadata, Menu, PredefinedMenuItem, Submenu};

    let metadata = AboutMetadata {
        name: Some("Pantoraya".to_string()),
        version: Some(env!("CARGO_PKG_VERSION").to_string()),
        copyright: Some("© 2026 Pantoraya".to_string()),
        credits: Some(t(language, "aboutCredit").to_string()),
        website: Some("https://github.com/VodoooFilms/pantoraya".to_string()),
        ..Default::default()
    };

    let about = PredefinedMenuItem::about(app, Some(t(language, "about")), Some(metadata))?;
    let separator_one = PredefinedMenuItem::separator(app)?;
    let hide = PredefinedMenuItem::hide(app, Some(t(language, "hide")))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some(t(language, "hideOthers")))?;
    let show_all = PredefinedMenuItem::show_all(app, Some(t(language, "unhide")))?;
    let separator_two = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some(t(language, "quit")))?;

    let app_menu = Submenu::with_items(
        app,
        "Pantoraya",
        true,
        &[
            &about,
            &separator_one,
            &hide,
            &hide_others,
            &show_all,
            &separator_two,
            &quit,
        ],
    )?;

    let undo = PredefinedMenuItem::undo(app, Some(t(language, "undo")))?;
    let redo = PredefinedMenuItem::redo(app, Some(t(language, "redo")))?;
    let separator_three = PredefinedMenuItem::separator(app)?;
    let cut = PredefinedMenuItem::cut(app, Some(t(language, "cut")))?;
    let copy = PredefinedMenuItem::copy(app, Some(t(language, "copy")))?;
    let paste = PredefinedMenuItem::paste(app, Some(t(language, "paste")))?;
    let select_all = PredefinedMenuItem::select_all(app, Some(t(language, "selectAll")))?;

    let edit_menu = Submenu::with_items(
        app,
        t(language, "edit"),
        true,
        &[
            &undo,
            &redo,
            &separator_three,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;

    let minimize = PredefinedMenuItem::minimize(app, Some(t(language, "minimize")))?;
    let zoom = PredefinedMenuItem::maximize(app, Some(t(language, "zoom")))?;
    let front = PredefinedMenuItem::bring_all_to_front(app, Some(t(language, "front")))?;
    let window_menu = Submenu::with_items(
        app,
        t(language, "window"),
        true,
        &[&minimize, &zoom, &front],
    )?;

    let menu = Menu::with_items(app, &[&app_menu, &edit_menu, &window_menu])?;
    let _ = app.set_menu(menu);
    Ok(())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = build_menu(&handle, "es");

            let permission_handle = handle.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(800));
                request_initial_folder_permissions(&permission_handle);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_files,
            choose_output_location,
            select_subtitle,
            inspect_file,
            inspect_files,
            inspect_subtitle,
            convert_media,
            cancel_conversion,
            show_in_folder,
            set_language
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pantoraya");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ffmpeg_timestamps() {
        assert!((parse_timestamp("01:02:03.5") - 3723.5).abs() < 0.001);
        assert_eq!(parse_timestamp("N/A"), 0.0);
    }

    #[test]
    fn extracts_probe_fields() {
        let line = "Duration: 00:00:10.00, start: 0.000000, bitrate: 1234 kb/s";
        assert_eq!(extract_after(line, "Duration:"), Some("00:00:10.00"));
        assert_eq!(
            extract_after("frame= 10 fps=0.0 time=00:00:05.00 bitrate=1", "time="),
            Some("00:00:05.00")
        );
    }

    #[test]
    fn builds_mp4_arguments() {
        let (profile, _, _) = profile_args("mp4", "light").expect("profile");
        let args = build_args(
            Path::new("/tmp/clip.mov"),
            "mp4",
            profile,
            &None,
            Path::new("/tmp/clip_liviano.mp4"),
        );
        assert_eq!(args.first().map(String::as_str), Some("-hide_banner"));
        assert!(args.contains(&"+faststart".to_string()));
        assert_eq!(
            args.last().map(String::as_str),
            Some("/tmp/clip_liviano.mp4")
        );
    }

    #[test]
    fn builds_subtitle_arguments() {
        let (profile, _, _) = profile_args("mp4", "quality").expect("profile");
        let subtitle = Some("/tmp/subs.srt".to_string());
        let args = build_args(
            Path::new("/tmp/clip.mov"),
            "mp4",
            profile,
            &subtitle,
            Path::new("/tmp/clip.mp4"),
        );
        assert!(args.windows(2).any(|pair| pair == ["-c:s", "mov_text"]));
        assert!(args.contains(&"/tmp/subs.srt".to_string()));
    }

    #[test]
    fn output_names_are_unique() {
        let directory =
            std::env::temp_dir().join(format!("pantoraya-rust-poc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).expect("temp directory");
        let input = directory.join("clip.mov");
        fs::write(&input, b"x").expect("input file");

        let first = unique_output_path(&input, "mp4", "", "", "es", None);
        assert_eq!(first.file_name().unwrap(), "clip.mp4");
        fs::write(&first, b"x").expect("first output");

        let second = unique_output_path(&input, "mp4", "", "", "es", None);
        assert_eq!(second.file_name().unwrap(), "clip-2.mp4");

        let suffixed = unique_output_path(&input, "mp4", "_liviano", "_light", "es", None);
        assert_eq!(suffixed.file_name().unwrap(), "clip_liviano.mp4");

        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn probes_and_thumbnails_a_real_image() {
        let ffmpeg = Path::new("/opt/homebrew/bin/ffmpeg");
        let icon = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/icons/pantoraya.png");
        if !ffmpeg.exists() || !icon.exists() {
            return;
        }

        let media = probe_file(ffmpeg, &icon);
        assert!(media.width > 0);
        assert!(media.height > 0);

        let thumbnail = thumbnail_for_file(ffmpeg, &icon, &media).expect("thumbnail");
        assert!(thumbnail.starts_with("data:image/png;base64,"));
        assert!(thumbnail.len() > 100);
    }
}
