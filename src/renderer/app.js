const COPY = {
  es: {
    converterTabs: 'Tipo de conversión', tabNames: { mp4: 'MP4', mp3: 'MP3', jpg: 'JPG' }, language: 'Idioma', switchLanguage: 'Cambiar a inglés', lightTheme: 'Cambiar a modo claro', darkTheme: 'Cambiar a modo oscuro',
    original: 'Original', remove: 'Quitar archivo', quality: 'Calidad de salida', estimate: 'Estimado', estimateTitle: 'Peso final estimado; puede variar según el contenido',
    preparing: 'Preparando…', ready: 'Listo', cancel: 'Cancelar', reveal: 'Mostrar en Finder', another: 'Convertir otro', anotherImage: 'Convertir otra imagen', subtitleAdd: '+ Añadir subtítulos SRT', subtitleOptional: '(opcional)', subtitleRemove: 'Quitar subtítulos', processed: 'Procesado', analyzing: 'Analizando…', compressing: 'Comprimiendo…', finishing: 'Finalizando…', smaller: 'más pequeño', failed: 'La conversión no pudo completarse.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Convierte videos a MP4', dropHint: 'arrastra un video o haz clic para abrir', action: 'Convertir a MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'Alta calidad', detail: 'Misma resolución' }, { id: 'light', name: 'Liviana', detail: 'Máx. 720p · audio HQ' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Arrastra un audio o video', dropHint: 'convierte audio o extráelo de un video', action: 'Convertir a MP3', format: 'MP3', profiles: [{ id: 'high', name: 'Alta calidad', detail: '320 kbps' }, { id: 'light', name: 'Liviana', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Convierte imágenes a JPG', dropHint: 'JPG · PNG · WEBP · BMP · TIFF', action: 'Convertir a JPG', format: 'JPG', profiles: [{ id: 'high', name: 'Alta calidad', detail: 'Dimensiones originales' }, { id: 'light', name: 'Liviana', detail: 'Máx. 1280 px' }] }
    }
  },
  en: {
    converterTabs: 'Conversion type', tabNames: { mp4: 'MP4', mp3: 'MP3', jpg: 'JPG' }, language: 'Language', switchLanguage: 'Switch to Spanish', lightTheme: 'Switch to light mode', darkTheme: 'Switch to dark mode',
    original: 'Original', remove: 'Remove file', quality: 'Output quality', estimate: 'Estimated', estimateTitle: 'Estimated final size; may vary depending on the content',
    preparing: 'Preparing…', ready: 'Ready', cancel: 'Cancel', reveal: 'Show in Folder', another: 'Convert Another', anotherImage: 'Convert More Images', subtitleAdd: '+ Add SRT subtitles', subtitleOptional: '(optional)', subtitleRemove: 'Remove subtitles', processed: 'Processed', analyzing: 'Analyzing…', compressing: 'Compressing…', finishing: 'Finishing…', smaller: 'smaller', failed: 'The conversion could not be completed.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Convert videos to MP4', dropHint: 'drop a video or click to browse', action: 'Convert to MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'High quality', detail: 'Same resolution' }, { id: 'light', name: 'Lightweight', detail: 'Max. 720p · HQ audio' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Drop an audio file or video', dropHint: 'convert audio or extract it from video', action: 'Convert to MP3', format: 'MP3', profiles: [{ id: 'high', name: 'High quality', detail: '320 kbps' }, { id: 'light', name: 'Lightweight', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Convert images to JPG', dropHint: 'JPG · PNG · WEBP · BMP · TIFF', action: 'Convert to JPG', format: 'JPG', profiles: [{ id: 'high', name: 'High quality', detail: 'Original dimensions' }, { id: 'light', name: 'Lightweight', detail: 'Max. 1280 px' }] }
    }
  }
};

if (window.pantoraya.platform !== 'darwin') {
  COPY.es.reveal = 'Mostrar en carpeta';
  COPY.en.reveal = 'Show in Folder';
  document.body.classList.add('windows');
}
if (window.pantoraya.platform === 'linux') document.body.classList.add('linux');

const savedLanguage = localStorage.getItem('pantoraya-language');
const state = { language: COPY[savedLanguage] ? savedLanguage : 'es', converter: 'mp4', file: null, files: [], subtitle: null, profile: 'quality', converting: false, cancelRequested: false, activeIndex: 0, completedCount: 0, outputPath: null, outputPaths: [] };
const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone');
const fileCard = $('fileCard');
const errorMessage = $('errorMessage');
const convertButton = $('convertButton');
const cancelButton = $('cancelButton');
const revealButton = $('revealButton');
const anotherButton = $('anotherButton');
const themeToggle = $('themeToggle');

function currentConverter() {
  return COPY[state.language].converters[state.converter];
}

function copy() {
  return COPY[state.language];
}

function currentAction() {
  if (state.files.length > 1) {
    const format = currentConverter().format;
    return state.language === 'es'
      ? `Convertir ${state.files.length} archivos a ${format}`
      : `Convert ${state.files.length} files to ${format}`;
  }
  return currentConverter().action;
}

function resetSubtitle() {
  state.subtitle = null;
  $('subtitleFile').textContent = '';
  $('subtitleFile').classList.add('hidden');
  $('subtitleLabel').classList.remove('hidden');
  $('subtitleRemove').classList.add('hidden');
}

function estimatedFileBytes(file, profileId) {
  if (!file?.size) return 0;
  const { size, duration = 0, width = 0, height = 0, name = '' } = file;

  if (state.converter === 'mp3') {
    const bitrates = { high: 320000, light: 128000 };
    return duration > 0 ? (duration * bitrates[profileId] / 8) * 1.02 : size * 0.35;
  }

  if (state.converter === 'mp4') {
    if (profileId === 'quality') return size * 0.85;
    const scale = width && height ? Math.min(1, 1280 / width, 720 / height) : 1;
    return size * Math.min(0.65, 0.42 * Math.max(0.18, scale ** 2));
  }

  const extension = name.split('.').pop()?.toLowerCase();
  const isAlreadyJpeg = extension === 'jpg' || extension === 'jpeg';
  const isWebp = extension === 'webp';
  if (profileId === 'high') return size * (isWebp ? 1.2 : isAlreadyJpeg ? 0.9 : 0.58);
  const scale = width && height ? Math.min(1, 1280 / width, 1280 / height) : 1;
  return size * (isWebp ? 0.48 : isAlreadyJpeg ? 0.35 : 0.28) * (scale ** 2);
}

function estimatedBytes(profileId) {
  const files = state.files.length ? state.files : state.file ? [state.file] : [];
  return files.reduce((total, file) => total + estimatedFileBytes(file, profileId), 0);
}

function updateEstimates() {
  document.querySelectorAll('[data-profile]').forEach((button) => {
    const output = button.querySelector('.profile-estimate strong');
    if (output) output.textContent = state.file ? `≈ ${formatBytes(estimatedBytes(button.dataset.profile))}` : '—';
  });
}

function renderProfiles() {
  const profileGrid = $('profileGrid');
  profileGrid.replaceChildren();
  for (const profile of currentConverter().profiles) {
    const button = document.createElement('button');
    button.className = `profile${profile.id === state.profile ? ' active' : ''}`;
    button.dataset.profile = profile.id;
    button.setAttribute('aria-pressed', profile.id === state.profile ? 'true' : 'false');

    const name = document.createElement('strong');
    name.textContent = profile.name;
    const detail = document.createElement('small');
    detail.textContent = profile.detail;
    const estimate = document.createElement('span');
    estimate.className = 'profile-estimate';
    estimate.title = copy().estimateTitle;
    const estimateLabel = document.createElement('small');
    estimateLabel.textContent = copy().estimate;
    const estimateValue = document.createElement('strong');
    estimateValue.textContent = state.file ? `≈ ${formatBytes(estimatedBytes(profile.id))}` : '—';
    estimate.append(estimateLabel, estimateValue);
    button.append(name, detail, estimate);
    profileGrid.append(button);
  }
  profileGrid.style.setProperty('--profile-count', currentConverter().profiles.length);
}

function resetFile() {
  state.file = null;
  state.files = [];
  state.outputPath = null;
  state.outputPaths = [];
  resetSubtitle();
  $('subtitlePicker').classList.add('hidden');
  document.body.classList.remove('has-subtitle-option');
  state.profile = currentConverter().defaultProfile;
  document.body.classList.remove('is-processing', 'is-complete');
  fileCard.classList.add('hidden');
  $('fileThumbnail').removeAttribute('src');
  $('fileThumbnail').classList.add('hidden');
  $('fileMark').classList.remove('hidden');
  fileCard.classList.remove('has-thumbnail');
  dropZone.classList.remove('hidden');
  $('progressPanel').classList.add('hidden');
  $('resultPanel').classList.add('hidden');
  cancelButton.classList.add('hidden');
  anotherButton.classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = true;
  $('profilesSection').classList.remove('hidden');
  convertButton.textContent = currentAction();
  anotherButton.textContent = copy().another;
  renderProfiles();
  setError();
}

function selectConverter(converterId) {
  if (!copy().converters[converterId] || state.converting || converterId === state.converter) return;
  state.converter = converterId;
  state.profile = currentConverter().defaultProfile;
  document.querySelectorAll('[data-converter]').forEach((tab) => {
    const isActive = tab.dataset.converter === converterId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });
  $('dropTitle').textContent = currentConverter().dropTitle;
  $('dropHint').textContent = currentConverter().dropHint;
  dropZone.setAttribute('aria-label', currentConverter().dropTitle);
  $('fileMark').dataset.format = currentConverter().format;
  convertButton.textContent = currentConverter().action;
  renderProfiles();
  resetFile();
}

function applyTheme(theme) {
  const isDark = theme !== 'light';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-label', isDark ? copy().lightTheme : copy().darkTheme);
  themeToggle.title = isDark ? copy().lightTheme : copy().darkTheme;
  localStorage.setItem('pantoraya-theme', isDark ? 'dark' : 'light');
}

function applyLanguage(language) {
  if (!COPY[language] || state.converting) return;
  state.language = language;
  document.documentElement.lang = language;
  localStorage.setItem('pantoraya-language', language);
  $('languageToggle').textContent = language.toUpperCase();
  $('languageToggle').setAttribute('aria-label', copy().switchLanguage);
  $('languageToggle').title = copy().switchLanguage;
  $('converterTabs').setAttribute('aria-label', copy().converterTabs);
  document.querySelectorAll('[data-converter]').forEach((tab) => {
    tab.textContent = copy().tabNames[tab.dataset.converter];
  });
  $('dropTitle').textContent = currentConverter().dropTitle;
  $('dropHint').textContent = currentConverter().dropHint;
  dropZone.setAttribute('aria-label', currentConverter().dropTitle);
  $('originalLabel').textContent = copy().original;
  $('removeButton').setAttribute('aria-label', copy().remove);
  $('subtitleLabel').replaceChildren(document.createTextNode(copy().subtitleAdd + ' '), Object.assign(document.createElement('small'), { textContent: copy().subtitleOptional }));
  $('subtitlePicker').setAttribute('aria-label', `${copy().subtitleAdd} ${copy().subtitleOptional}`);
  $('subtitleRemove').setAttribute('aria-label', copy().subtitleRemove);
  $('profilesSection').setAttribute('aria-label', copy().quality);
  $('resultTitle').textContent = copy().ready;
  cancelButton.textContent = copy().cancel;
  anotherButton.textContent = copy().another;
  revealButton.textContent = copy().reveal;
  convertButton.textContent = currentAction();
  if (!state.converting) $('progressLabel').textContent = copy().preparing;
  renderProfiles();
  applyTheme(localStorage.getItem('pantoraya-theme') || 'dark');
  window.pantoraya.setLanguage(language).catch(() => {});
}

applyLanguage(state.language);
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
document.querySelector('#languageToggle').addEventListener('click', (event) => {
  applyLanguage(state.language === 'es' ? 'en' : 'es');
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const megabytes = bytes / (1024 ** 2);
  return `${megabytes < 1 ? megabytes.toFixed(2) : megabytes.toFixed(1)} MB`;
}

function setError(message = '') {
  errorMessage.textContent = message;
  errorMessage.classList.toggle('hidden', !message);
}

function setFile(file, files = [file]) {
  const detectedConverter = file.mediaType === 'audio'
    ? 'mp3'
    : file.mediaType === 'image' ? 'jpg' : (file.mediaType === 'video' && state.converter !== 'mp3' ? 'mp4' : state.converter);
  if (detectedConverter !== state.converter) selectConverter(detectedConverter);

  files = files.filter((item) => {
    if (state.converter === 'mp4') return item.mediaType === 'video';
    if (state.converter === 'mp3') return item.mediaType === 'video' || item.mediaType === 'audio';
    if (state.converter === 'jpg') return item.mediaType === 'image';
    return false;
  });
  if (!files.length) return;
  file = files[0];

  state.file = file;
  state.files = files;
  state.profile = currentConverter().defaultProfile;
  state.outputPath = null;
  document.body.classList.remove('is-processing', 'is-complete');
  $('fileName').textContent = files.length > 1 ? `${file.name}  +${files.length - 1}` : file.name;
  $('fileSize').textContent = formatBytes(files.reduce((total, item) => total + item.size, 0));
  if (file.thumbnail) {
    $('fileThumbnail').src = file.thumbnail;
    $('fileThumbnail').classList.remove('hidden');
    $('fileMark').classList.add('hidden');
    fileCard.classList.add('has-thumbnail');
  } else {
    $('fileThumbnail').removeAttribute('src');
    $('fileThumbnail').classList.add('hidden');
    $('fileMark').classList.remove('hidden');
    fileCard.classList.remove('has-thumbnail');
  }
  fileCard.classList.remove('hidden');
  dropZone.classList.add('hidden');
  const showSubtitlePicker = files.length === 1 && state.converter === 'mp4' && file.mediaType === 'video';
  $('subtitlePicker').classList.toggle('hidden', !showSubtitlePicker);
  document.body.classList.toggle('has-subtitle-option', showSubtitlePicker);
  if (!showSubtitlePicker) resetSubtitle();
  $('fileMark').dataset.format = currentConverter().format;
  $('resultPanel').classList.add('hidden');
  anotherButton.classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = false;
  convertButton.textContent = currentAction();
  anotherButton.textContent = state.converter === 'jpg' && files.length > 1 ? copy().anotherImage : copy().another;
  renderProfiles();
  setError();
}

async function chooseFile() {
  if (state.converting) return;
  try {
    const files = await window.pantoraya.selectFiles(state.converter);
    if (files.length) setFile(files[0], files);
  } catch (error) { setError(error.message); }
}

document.querySelector('.converter-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-converter]');
  if (tab) selectConverter(tab.dataset.converter);
});

document.querySelector('.converter-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || state.converting) return;
  const tabs = [...document.querySelectorAll('[data-converter]')];
  const currentIndex = tabs.findIndex((tab) => tab.dataset.converter === state.converter);
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  selectConverter(tabs[nextIndex].dataset.converter);
  tabs[nextIndex].focus();
});

dropZone.addEventListener('click', chooseFile);
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseFile(); }
});
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); });
}
dropZone.addEventListener('drop', async (event) => {
  const dropped = [...event.dataTransfer.files];
  if (!dropped.length) return;
  try {
    const files = await window.pantoraya.inspectFiles(dropped.map((file) => window.pantoraya.pathForFile(file)));
    setFile(files[0], files);
  }
  catch (error) { setError(error.message); }
});

function setSubtitle(subtitle) {
  state.subtitle = subtitle;
  $('subtitleFile').textContent = subtitle.name;
  $('subtitleFile').classList.remove('hidden');
  $('subtitleLabel').classList.add('hidden');
  $('subtitleRemove').classList.remove('hidden');
  setError();
}

async function chooseSubtitle() {
  if (state.converting) return;
  try {
    const subtitle = await window.pantoraya.selectSubtitle();
    if (subtitle) setSubtitle(subtitle);
  } catch (error) { setError(error.message); }
}

$('subtitlePicker').addEventListener('click', chooseSubtitle);
$('subtitlePicker').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseSubtitle(); }
});
for (const eventName of ['dragenter', 'dragover']) {
  $('subtitlePicker').addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); $('subtitlePicker').classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  $('subtitlePicker').addEventListener(eventName, (event) => { event.preventDefault(); event.stopPropagation(); $('subtitlePicker').classList.remove('dragging'); });
}
$('subtitlePicker').addEventListener('drop', async (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  try { setSubtitle(await window.pantoraya.inspectSubtitle(window.pantoraya.pathForFile(file))); }
  catch (error) { setError(error.message); }
});
$('subtitleRemove').addEventListener('click', (event) => { event.stopPropagation(); resetSubtitle(); });

$('removeButton').addEventListener('click', () => { if (!state.converting) resetFile(); });

$('profileGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-profile]');
  if (!button || state.converting) return;
  document.querySelectorAll('[data-profile]').forEach((node) => {
    const isActive = node === button;
    node.classList.toggle('active', isActive);
    node.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  state.profile = button.dataset.profile;
});

const stopProgress = window.pantoraya.onProgress(({ percent, timemark }) => {
  const total = Math.max(1, state.files.length);
  const overallPercent = Math.round(((state.completedCount + (percent / 100)) / total) * 100);
  $('progressBar').style.width = `${overallPercent}%`;
  $('progressPercent').textContent = `${overallPercent}%`;
  $('progressTime').textContent = timemark ? `${copy().processed}: ${timemark}` : '';
  const phase = percent < 20 ? copy().analyzing : percent < 90 ? copy().compressing : copy().finishing;
  $('progressLabel').textContent = state.files.length > 1 ? `${state.activeIndex + 1}/${state.files.length} · ${phase}` : phase;
});
const stopStatus = window.pantoraya.onStatus(({ message }) => {
  if (message) $('progressLabel').textContent = state.files.length > 1 ? `${state.activeIndex + 1}/${state.files.length} · ${message}` : message;
});
window.addEventListener('beforeunload', () => { stopProgress(); stopStatus(); });

convertButton.addEventListener('click', async () => {
  if (!state.file || state.converting) return;
  let destination;
  try {
    destination = await window.pantoraya.chooseOutputLocation();
    if (destination.canceled) return;
  } catch (error) {
    setError(error.message || copy().failed);
    return;
  }
  state.converting = true;
  state.cancelRequested = false;
  state.completedCount = 0;
  state.outputPaths = [];
  document.body.classList.remove('is-complete');
  document.body.classList.add('is-processing');
  setError();
  convertButton.classList.add('hidden');
  cancelButton.classList.remove('hidden');
  $('progressPanel').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressPercent').textContent = '0%';
  try {
    const results = [];
    const errors = [];
    for (let index = 0; index < state.files.length; index += 1) {
      if (state.cancelRequested) break;
      state.activeIndex = index;
      try {
        const result = await window.pantoraya.convertMedia(
          state.files[index].path,
          state.converter,
          state.profile,
          state.files.length === 1 ? state.subtitle?.path || null : null,
          { outputDirectory: destination.path }
        );
        results.push(result);
        state.outputPaths.push(result.outputPath);
        state.completedCount += 1;
      } catch (error) {
        if (state.cancelRequested) break;
        errors.push(error);
      }
    }
    if (state.cancelRequested) {
      document.body.classList.remove('is-processing');
      $('progressPanel').classList.add('hidden');
      cancelButton.classList.add('hidden');
      convertButton.classList.remove('hidden');
      return;
    }
    if (!results.length) throw errors[0] || new Error(copy().failed);
    const result = results[0];
    state.outputPath = result.outputPath;
    document.body.classList.remove('is-processing');
    document.body.classList.add('is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    revealButton.classList.remove('hidden');
    revealButton.textContent = copy().reveal;
    const inputBytes = results.reduce((total, item) => total + item.inputBytes, 0);
    const outputBytes = results.reduce((total, item) => total + item.outputBytes, 0);
    const delta = inputBytes ? Math.round((1 - outputBytes / inputBytes) * 100) : 0;
    $('resultPanel').classList.remove('hidden');
    if (state.files.length > 1) {
      $('resultDetails').textContent = `${results.length}/${state.files.length} · ${formatBytes(outputBytes)}`;
      if (errors.length) setError(errors[0].message || copy().failed);
    } else {
      $('resultDetails').textContent = `${formatBytes(result.outputBytes)}${delta > 0 ? ` · ${delta}% ${copy().smaller}` : ''}`;
    }
    if (state.converter === 'jpg') anotherButton.classList.remove('hidden');
    anotherButton.textContent = state.converter === 'jpg' && state.files.length > 1 ? copy().anotherImage : copy().another;
  } catch (error) {
    document.body.classList.remove('is-processing', 'is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    convertButton.classList.remove('hidden');
    setError(error.message || copy().failed);
  } finally { state.converting = false; }
});

cancelButton.addEventListener('click', async () => {
  state.cancelRequested = true;
  cancelButton.disabled = true;
  await window.pantoraya.cancelConversion();
  cancelButton.disabled = false;
});
anotherButton.addEventListener('click', resetFile);
revealButton.addEventListener('click', async () => {
  if (!state.outputPath) return;
  window.pantoraya.showInFolder(state.outputPath);
});
