const COPY = {
  es: {
    converterTabs: 'Tipo de conversión', language: 'Idioma', switchLanguage: 'Cambiar a inglés', lightTheme: 'Cambiar a modo claro', darkTheme: 'Cambiar a modo oscuro',
    original: 'Original', remove: 'Quitar archivo', quality: 'Calidad de salida', estimate: 'Estimado', estimateTitle: 'Peso final estimado; puede variar según el contenido',
    preparing: 'Preparando…', ready: 'Listo', cancel: 'Cancelar', reveal: 'Mostrar en Finder', processed: 'Procesado', analyzing: 'Analizando…', compressing: 'Comprimiendo…', finishing: 'Finalizando…', smaller: 'más pequeño', failed: 'La conversión no pudo completarse.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Arrastra un video', dropHint: 'o haz clic para abrir', action: 'Convertir a MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'Alta calidad', detail: 'Misma resolución' }, { id: 'light', name: 'Liviana', detail: 'Máx. 720p · audio HQ' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Arrastra un audio o video', dropHint: 'convierte audio o extráelo de un video', action: 'Convertir a MP3', format: 'MP3', profiles: [{ id: 'high', name: 'Alta calidad', detail: '320 kbps' }, { id: 'light', name: 'Liviana', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Arrastra una imagen', dropHint: 'reduce su peso sin cambiar sus dimensiones', action: 'Comprimir a JPG', format: 'JPG', profiles: [{ id: 'high', name: 'Alta calidad', detail: 'Dimensiones originales' }, { id: 'light', name: 'Liviana', detail: 'Máx. 1280 px' }] }
    }
  },
  en: {
    converterTabs: 'Conversion type', language: 'Language', switchLanguage: 'Switch to Spanish', lightTheme: 'Switch to light mode', darkTheme: 'Switch to dark mode',
    original: 'Original', remove: 'Remove file', quality: 'Output quality', estimate: 'Estimated', estimateTitle: 'Estimated final size; may vary depending on the content',
    preparing: 'Preparing…', ready: 'Ready', cancel: 'Cancel', reveal: 'Show in Finder', processed: 'Processed', analyzing: 'Analyzing…', compressing: 'Compressing…', finishing: 'Finishing…', smaller: 'smaller', failed: 'The conversion could not be completed.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Drop a video', dropHint: 'or click to browse', action: 'Convert to MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'High quality', detail: 'Same resolution' }, { id: 'light', name: 'Lightweight', detail: 'Max. 720p · HQ audio' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Drop an audio file or video', dropHint: 'convert audio or extract it from video', action: 'Convert to MP3', format: 'MP3', profiles: [{ id: 'high', name: 'High quality', detail: '320 kbps' }, { id: 'light', name: 'Lightweight', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Drop an image', dropHint: 'reduce its size without changing dimensions', action: 'Compress to JPG', format: 'JPG', profiles: [{ id: 'high', name: 'High quality', detail: 'Original dimensions' }, { id: 'light', name: 'Lightweight', detail: 'Max. 1280 px' }] }
    }
  }
};

const savedLanguage = localStorage.getItem('pantoraya-language');
const state = { language: COPY[savedLanguage] ? savedLanguage : 'es', converter: 'mp4', file: null, profile: 'quality', converting: false, outputPath: null };
const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone');
const fileCard = $('fileCard');
const errorMessage = $('errorMessage');
const convertButton = $('convertButton');
const cancelButton = $('cancelButton');
const revealButton = $('revealButton');
const themeToggle = $('themeToggle');

function currentConverter() {
  return COPY[state.language].converters[state.converter];
}

function copy() {
  return COPY[state.language];
}

function estimatedBytes(profileId) {
  if (!state.file?.size) return 0;
  const { size, duration = 0, width = 0, height = 0, name = '' } = state.file;

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
  state.outputPath = null;
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
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = true;
  updateEstimates();
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
  $('languageToggle').setAttribute('aria-label', copy().language);
  $('dropTitle').textContent = currentConverter().dropTitle;
  $('dropHint').textContent = currentConverter().dropHint;
  dropZone.setAttribute('aria-label', currentConverter().dropTitle);
  $('originalLabel').textContent = copy().original;
  $('removeButton').setAttribute('aria-label', copy().remove);
  $('profilesSection').setAttribute('aria-label', copy().quality);
  $('resultTitle').textContent = copy().ready;
  cancelButton.textContent = copy().cancel;
  revealButton.textContent = copy().reveal;
  convertButton.textContent = currentConverter().action;
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

function setFile(file) {
  const detectedConverter = file.mediaType === 'audio'
    ? 'mp3'
    : file.mediaType === 'image' ? 'jpg' : state.converter === 'mp3' ? 'mp3' : 'mp4';
  if (detectedConverter !== state.converter) selectConverter(detectedConverter);

  state.file = file;
  state.outputPath = null;
  document.body.classList.remove('is-processing', 'is-complete');
  $('fileName').textContent = file.name;
  $('fileSize').textContent = formatBytes(file.size);
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
  $('resultPanel').classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = false;
  updateEstimates();
  setError();
}

async function chooseFile() {
  if (state.converting) return;
  try {
    const file = await window.pantoraya.selectFile();
    if (file) setFile(file);
  } catch (error) { setError(error.message); }
}

document.querySelector('.converter-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-converter]');
  if (tab) selectConverter(tab.dataset.converter);
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
  const file = event.dataTransfer.files[0];
  if (!file) return;
  try { setFile(await window.pantoraya.inspectFile(window.pantoraya.pathForFile(file))); }
  catch (error) { setError(error.message); }
});

$('removeButton').addEventListener('click', resetFile);

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
  $('progressBar').style.width = `${percent}%`;
  $('progressPercent').textContent = `${percent}%`;
  $('progressTime').textContent = timemark ? `${copy().processed}: ${timemark}` : '';
  $('progressLabel').textContent = percent < 20 ? copy().analyzing : percent < 90 ? copy().compressing : copy().finishing;
});
const stopStatus = window.pantoraya.onStatus(({ message }) => { if (message) $('progressLabel').textContent = message; });
window.addEventListener('beforeunload', () => { stopProgress(); stopStatus(); });

convertButton.addEventListener('click', async () => {
  if (!state.file || state.converting) return;
  state.converting = true;
  document.body.classList.remove('is-complete');
  document.body.classList.add('is-processing');
  setError();
  convertButton.classList.add('hidden');
  cancelButton.classList.remove('hidden');
  $('progressPanel').classList.remove('hidden');
  $('progressBar').style.width = '0%';
  $('progressPercent').textContent = '0%';
  try {
    const result = await window.pantoraya.convertMedia(state.file.path, state.converter, state.profile);
    state.outputPath = result.outputPath;
    document.body.classList.remove('is-processing');
    document.body.classList.add('is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    revealButton.classList.remove('hidden');
    $('resultPanel').classList.remove('hidden');
    const delta = result.inputBytes ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0;
    $('resultDetails').textContent = `${formatBytes(result.outputBytes)}${delta > 0 ? ` · ${delta}% ${copy().smaller}` : ''}`;
  } catch (error) {
    document.body.classList.remove('is-processing', 'is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    convertButton.classList.remove('hidden');
    setError(error.message || copy().failed);
  } finally { state.converting = false; }
});

cancelButton.addEventListener('click', async () => {
  cancelButton.disabled = true;
  await window.pantoraya.cancelConversion();
  cancelButton.disabled = false;
});
revealButton.addEventListener('click', () => { if (state.outputPath) window.pantoraya.showInFolder(state.outputPath); });
