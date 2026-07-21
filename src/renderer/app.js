const COPY = {
  es: {
    converterTabs: 'Tipo de conversión', tabNames: { mp4: 'MP4', mp3: 'MP3', jpg: 'JPG', pdf: 'PDF' }, language: 'Idioma', switchLanguage: 'Cambiar a inglés', lightTheme: 'Cambiar a modo claro', darkTheme: 'Cambiar a modo oscuro',
    original: 'Original', remove: 'Quitar archivo', quality: 'Calidad de salida', estimate: 'Estimado', estimateTitle: 'Peso final estimado; puede variar según el contenido',
    preparing: 'Preparando…', ready: 'Listo', cancel: 'Cancelar', reveal: 'Mostrar en Finder', saveAs: 'Guardar como…', anotherPdf: 'Comprimir otro PDF', anotherDocument: 'Convertir otro documento', docAction: 'Convertir a PDF', originalSize: 'Original', compressedSize: 'Comprimido', reduction: 'Reducción', estimatedQuality: 'Calidad estimada', processed: 'Procesado', analyzing: 'Analizando…', compressing: 'Comprimiendo…', finishing: 'Finalizando…', smaller: 'más pequeño', failed: 'La conversión no pudo completarse.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Arrastra un video', dropHint: 'o haz clic para abrir', action: 'Convertir a MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'Alta calidad', detail: 'Misma resolución' }, { id: 'light', name: 'Liviana', detail: 'Máx. 720p · audio HQ' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Arrastra un audio o video', dropHint: 'convierte audio o extráelo de un video', action: 'Convertir a MP3', format: 'MP3', profiles: [{ id: 'high', name: 'Alta calidad', detail: '320 kbps' }, { id: 'light', name: 'Liviana', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Arrastra una imagen', dropHint: 'reduce su peso sin cambiar sus dimensiones', action: 'Comprimir a JPG', format: 'JPG', profiles: [{ id: 'high', name: 'Alta calidad', detail: 'Dimensiones originales' }, { id: 'light', name: 'Liviana', detail: 'Máx. 1280 px' }] },
      pdf: { defaultProfile: 'high', dropTitle: 'Arrastra un PDF o documento', dropHint: 'PDF · DOC · DOCX · TXT · RTF · ODT', action: 'Comprimir PDF', format: 'PDF', profiles: [{ id: 'high', name: 'Alta calidad', detail: 'Mejor calidad' }, { id: 'light', name: 'Liviana', detail: 'Archivo más pequeño' }] }
    }
  },
  en: {
    converterTabs: 'Conversion type', tabNames: { mp4: 'MP4', mp3: 'MP3', jpg: 'JPG', pdf: 'PDF' }, language: 'Language', switchLanguage: 'Switch to Spanish', lightTheme: 'Switch to light mode', darkTheme: 'Switch to dark mode',
    original: 'Original', remove: 'Remove file', quality: 'Output quality', estimate: 'Estimated', estimateTitle: 'Estimated final size; may vary depending on the content',
    preparing: 'Preparing…', ready: 'Ready', cancel: 'Cancel', reveal: 'Show in Finder', saveAs: 'Save As…', anotherPdf: 'Compress Another PDF', anotherDocument: 'Convert Another Document', docAction: 'Convert to PDF', originalSize: 'Original', compressedSize: 'Compressed', reduction: 'Reduction', estimatedQuality: 'Estimated quality', processed: 'Processed', analyzing: 'Analyzing…', compressing: 'Compressing…', finishing: 'Finishing…', smaller: 'smaller', failed: 'The conversion could not be completed.',
    converters: {
      mp4: { defaultProfile: 'quality', dropTitle: 'Drop a video', dropHint: 'or click to browse', action: 'Convert to MP4', format: 'MP4', profiles: [{ id: 'quality', name: 'High quality', detail: 'Same resolution' }, { id: 'light', name: 'Lightweight', detail: 'Max. 720p · HQ audio' }] },
      mp3: { defaultProfile: 'high', dropTitle: 'Drop an audio file or video', dropHint: 'convert audio or extract it from video', action: 'Convert to MP3', format: 'MP3', profiles: [{ id: 'high', name: 'High quality', detail: '320 kbps' }, { id: 'light', name: 'Lightweight', detail: '128 kbps' }] },
      jpg: { defaultProfile: 'high', dropTitle: 'Drop an image', dropHint: 'reduce its size without changing dimensions', action: 'Compress to JPG', format: 'JPG', profiles: [{ id: 'high', name: 'High quality', detail: 'Original dimensions' }, { id: 'light', name: 'Lightweight', detail: 'Max. 1280 px' }] },
      pdf: { defaultProfile: 'high', dropTitle: 'Drop a PDF or document', dropHint: 'PDF · DOC · DOCX · TXT · RTF · ODT', action: 'Compress PDF', format: 'PDF', profiles: [{ id: 'high', name: 'High quality', detail: 'Best quality' }, { id: 'light', name: 'Lightweight', detail: 'Smallest file' }] }
    }
  }
};

const savedLanguage = localStorage.getItem('pantoraya-language');
const state = { language: COPY[savedLanguage] ? savedLanguage : 'es', converter: 'mp4', file: null, profile: 'quality', converting: false, outputPath: null, suggestedOutputPath: null, pdfSaved: false };
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

function isDocumentFile() {
  return state.converter === 'pdf' && state.file?.mediaType === 'document';
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

  if (state.converter === 'pdf') return size * (profileId === 'high' ? 0.8 : 0.45);

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
  if (state.converter === 'pdf' && state.outputPath) window.pantoraya.discardOutput(state.outputPath).catch(() => {});
  state.file = null;
  state.outputPath = null;
  state.suggestedOutputPath = null;
  state.pdfSaved = false;
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
  $('pdfResultPanel').classList.add('hidden');
  cancelButton.classList.add('hidden');
  anotherButton.classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = true;
  $('profilesSection').classList.remove('hidden');
  convertButton.textContent = currentConverter().action;
  anotherButton.textContent = copy().anotherPdf;
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
  $('profilesSection').setAttribute('aria-label', copy().quality);
  $('resultTitle').textContent = copy().ready;
  $('pdfResultTitle').textContent = copy().ready;
  $('pdfOriginalLabel').textContent = copy().originalSize;
  $('pdfCompressedLabel').textContent = copy().compressedSize;
  $('pdfReductionLabel').textContent = copy().reduction;
  $('pdfQualityLabel').textContent = copy().estimatedQuality;
  cancelButton.textContent = copy().cancel;
  anotherButton.textContent = isDocumentFile() ? copy().anotherDocument : copy().anotherPdf;
  revealButton.textContent = state.converter === 'pdf' && document.body.classList.contains('is-complete') && !state.pdfSaved ? copy().saveAs : copy().reveal;
  convertButton.textContent = isDocumentFile() ? copy().docAction : currentConverter().action;
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
    : file.mediaType === 'image' ? 'jpg' : ['pdf', 'document'].includes(file.mediaType) ? 'pdf' : state.converter === 'mp3' ? 'mp3' : 'mp4';
  if (detectedConverter !== state.converter) selectConverter(detectedConverter);

  state.file = file;
  state.profile = file.mediaType === 'document' ? 'document' : currentConverter().defaultProfile;
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
  $('profilesSection').classList.toggle('hidden', file.mediaType === 'document');
  $('fileMark').dataset.format = file.mediaType === 'document' ? 'DOC' : currentConverter().format;
  $('resultPanel').classList.add('hidden');
  $('pdfResultPanel').classList.add('hidden');
  anotherButton.classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = false;
  convertButton.textContent = file.mediaType === 'document' ? copy().docAction : currentConverter().action;
  anotherButton.textContent = file.mediaType === 'document' ? copy().anotherDocument : copy().anotherPdf;
  if (file.mediaType !== 'document') renderProfiles();
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
  const file = event.dataTransfer.files[0];
  if (!file) return;
  try { setFile(await window.pantoraya.inspectFile(window.pantoraya.pathForFile(file))); }
  catch (error) { setError(error.message); }
});

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
    state.suggestedOutputPath = result.suggestedOutputPath || null;
    state.pdfSaved = false;
    document.body.classList.remove('is-processing');
    document.body.classList.add('is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    revealButton.classList.remove('hidden');
    const delta = result.inputBytes ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0;
    if (state.converter === 'pdf' && !isDocumentFile()) {
      $('pdfOriginalSize').textContent = formatBytes(result.inputBytes);
      $('pdfCompressedSize').textContent = formatBytes(result.outputBytes);
      $('pdfReduction').textContent = `${Math.max(0, delta)}%`;
      $('pdfQuality').textContent = currentConverter().profiles.find((profile) => profile.id === state.profile)?.name || '';
      $('pdfResultPanel').classList.remove('hidden');
      revealButton.textContent = copy().saveAs;
      anotherButton.classList.remove('hidden');
    } else if (isDocumentFile()) {
      $('resultPanel').classList.remove('hidden');
      $('resultDetails').textContent = formatBytes(result.outputBytes);
      revealButton.textContent = copy().saveAs;
      anotherButton.classList.remove('hidden');
    } else {
      $('resultPanel').classList.remove('hidden');
      $('resultDetails').textContent = `${formatBytes(result.outputBytes)}${delta > 0 ? ` · ${delta}% ${copy().smaller}` : ''}`;
      revealButton.textContent = copy().reveal;
    }
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
anotherButton.addEventListener('click', resetFile);
revealButton.addEventListener('click', async () => {
  if (!state.outputPath) return;
  try {
    if (state.converter === 'pdf' && !state.pdfSaved) {
      const savedPath = await window.pantoraya.saveOutputAs(state.outputPath, state.suggestedOutputPath);
      if (savedPath) {
        state.outputPath = savedPath;
        state.suggestedOutputPath = null;
        state.pdfSaved = true;
        revealButton.textContent = copy().reveal;
      }
    } else window.pantoraya.showInFolder(state.outputPath);
  } catch (error) { setError(error.message || copy().failed); }
});
