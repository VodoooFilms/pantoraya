const state = { file: null, profile: 'quality', converting: false, outputPath: null };
const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone');
const fileCard = $('fileCard');
const errorMessage = $('errorMessage');
const convertButton = $('convertButton');
const cancelButton = $('cancelButton');
const revealButton = $('revealButton');
const themeToggle = $('themeToggle');

function applyTheme(theme) {
  const isDark = theme !== 'light';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  themeToggle.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  localStorage.setItem('pantoraya-theme', isDark ? 'dark' : 'light');
}

applyTheme(localStorage.getItem('pantoraya-theme') || 'dark');
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function setError(message = '') {
  errorMessage.textContent = message;
  errorMessage.classList.toggle('hidden', !message);
}

function setFile(file) {
  state.file = file;
  state.outputPath = null;
  document.body.classList.remove('is-processing', 'is-complete');
  $('fileName').textContent = file.name;
  $('fileSize').textContent = formatBytes(file.size);
  fileCard.classList.remove('hidden');
  dropZone.classList.add('hidden');
  $('resultPanel').classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = false;
  setError();
}

async function chooseFile() {
  if (state.converting) return;
  const file = await window.pantoraya.selectFile();
  if (file) setFile(file);
}

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

$('removeButton').addEventListener('click', () => {
  state.file = null;
  state.outputPath = null;
  document.body.classList.remove('is-processing', 'is-complete');
  fileCard.classList.add('hidden');
  dropZone.classList.remove('hidden');
  $('resultPanel').classList.add('hidden');
  revealButton.classList.add('hidden');
  convertButton.classList.remove('hidden');
  convertButton.disabled = true;
  setError();
});

$('profileGrid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-profile]');
  if (!button || state.converting) return;
  document.querySelectorAll('[data-profile]').forEach((node) => node.classList.toggle('active', node === button));
  state.profile = button.dataset.profile;
});

const stopProgress = window.pantoraya.onProgress(({ percent, timemark }) => {
  $('progressBar').style.width = `${percent}%`;
  $('progressPercent').textContent = `${percent}%`;
  $('progressTime').textContent = timemark ? `Procesado: ${timemark}` : '';
  $('progressLabel').textContent = percent < 20 ? 'Analizando video…' : percent < 90 ? 'Comprimiendo…' : 'Finalizando…';
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
    const result = await window.pantoraya.convertVideo(state.file.path, state.profile);
    state.outputPath = result.outputPath;
    document.body.classList.remove('is-processing');
    document.body.classList.add('is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    revealButton.classList.remove('hidden');
    $('resultPanel').classList.remove('hidden');
    const delta = result.inputBytes ? Math.round((1 - result.outputBytes / result.inputBytes) * 100) : 0;
    $('resultDetails').textContent = `${formatBytes(result.outputBytes)}${delta > 0 ? ` · ${delta}% más pequeño` : ''}`;
  } catch (error) {
    document.body.classList.remove('is-processing', 'is-complete');
    $('progressPanel').classList.add('hidden');
    cancelButton.classList.add('hidden');
    convertButton.classList.remove('hidden');
    setError(error.message || 'La conversión no pudo completarse.');
  } finally { state.converting = false; }
});

cancelButton.addEventListener('click', async () => {
  cancelButton.disabled = true;
  await window.pantoraya.cancelConversion();
  cancelButton.disabled = false;
});
revealButton.addEventListener('click', () => { if (state.outputPath) window.pantoraya.showInFolder(state.outputPath); });
