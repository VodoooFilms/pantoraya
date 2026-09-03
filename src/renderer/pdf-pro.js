import * as pdfjsLib from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;

const $ = (id) => document.getElementById(id);
const TEXT = {
  es: {
    emptyTitle: 'Edita y organiza un PDF', emptyHint: 'abre un documento para comenzar',
    page: 'Página', of: 'de', selected: 'seleccionadas', add: '+ Añadir', replace: 'Reemplazar', rotate: '↻ Rotar', remove: 'Eliminar', extract: 'Extraer', save: 'Guardar una copia', cancel: 'Cancelar',
    fullscreen: 'Pantalla completa', close: 'Cerrar documento', undo: 'Deshacer', redo: 'Rehacer', previous: 'Página anterior', next: 'Página siguiente', zoomOut: 'Alejar', zoomIn: 'Acercar',
    opening: 'Abriendo documento…', rendering: 'Preparando páginas…', saving: 'Guardando copia…', saved: 'Copia guardada · clic para mostrar', extracting: 'Extrayendo páginas…', failed: 'No se pudo completar la operación.', unsaved: 'Cambios sin guardar'
  },
  en: {
    emptyTitle: 'Edit and organize a PDF', emptyHint: 'open a document to begin',
    page: 'Page', of: 'of', selected: 'selected', add: '+ Add', replace: 'Replace', rotate: '↻ Rotate', remove: 'Delete', extract: 'Extract', save: 'Save a copy', cancel: 'Cancel',
    fullscreen: 'Full screen', close: 'Close document', undo: 'Undo', redo: 'Redo', previous: 'Previous page', next: 'Next page', zoomOut: 'Zoom out', zoomIn: 'Zoom in',
    opening: 'Opening document…', rendering: 'Preparing pages…', saving: 'Saving copy…', saved: 'Copy saved · click to reveal', extracting: 'Extracting pages…', failed: 'The operation could not be completed.', unsaved: 'Unsaved changes'
  }
};

let language = document.documentElement.lang === 'en' ? 'en' : 'es';
let manifest = null;
let currentPageId = null;
let anchorPageId = null;
let selectedPageIds = new Set();
let sourceDocuments = new Map();
let thumbnailObserver = null;
let previewRenderTask = null;
let previewToken = 0;
let zoom = 1;
let busy = false;
let outputPath = null;
let fullscreen = false;
let draggedPageIds = [];

function text() { return TEXT[language]; }
function currentIndex() { return manifest?.pages.findIndex((page) => page.id === currentPageId) ?? -1; }
function currentPage() { return manifest?.pages.find((page) => page.id === currentPageId) || null; }

function setError(message = '') {
  $('pdfProError').textContent = message;
  $('pdfProError').classList.toggle('hidden', !message);
}

function setBusy(value, label = '') {
  busy = value;
  document.body.classList.toggle('pdf-pro-busy', value);
  $('pdfProStatus').classList.toggle('hidden', !value && !label);
  $('pdfProStatus').querySelector('.track').classList.toggle('hidden', !value);
  $('pdfProStatusText').textContent = label;
  $('pdfProCancel').classList.toggle('hidden', !value);
  updateControls();
}

function destroySources() {
  for (const documentPromise of sourceDocuments.values()) {
    Promise.resolve(documentPromise).then((document) => document.destroy()).catch(() => {});
  }
  sourceDocuments = new Map();
}

async function pdfSource(sourceId) {
  if (!sourceDocuments.has(sourceId)) {
    sourceDocuments.set(sourceId, (async () => {
      const bytes = await window.pantoraya.pdfProSource(manifest.sessionId, sourceId);
      return pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    })());
  }
  return sourceDocuments.get(sourceId);
}

async function pdfPage(page) {
  const document = await pdfSource(page.sourceId);
  return document.getPage(page.sourcePageIndex + 1);
}

function pageRotation(page, pdfPageObject) {
  const original = Number(pdfPageObject.rotate) || 0;
  const storedOriginal = Number(page.rotation) || 0;
  return ((storedOriginal || original) % 360 + 360) % 360;
}

async function renderThumbnail(button, page) {
  if (button.dataset.rendered === 'true') return;
  button.dataset.rendered = 'loading';
  try {
    const sourcePage = await pdfPage(page);
    if (!button.isConnected) return;
    const base = sourcePage.getViewport({ scale: 1, rotation: pageRotation(page, sourcePage) });
    const scale = Math.min(108 / base.width, 102 / base.height);
    const viewport = sourcePage.getViewport({ scale, rotation: pageRotation(page, sourcePage) });
    const canvas = button.querySelector('canvas');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    await sourcePage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] }).promise;
    button.dataset.rendered = 'true';
  } catch (error) {
    button.dataset.rendered = 'error';
  }
}

async function renderPreview() {
  const page = currentPage();
  if (!page) return;
  const token = ++previewToken;
  if (previewRenderTask) {
    try { previewRenderTask.cancel(); } catch (_) {}
    previewRenderTask = null;
  }
  try {
    const sourcePage = await pdfPage(page);
    if (token !== previewToken) return;
    const wrap = $('pdfProCanvasWrap');
    const base = sourcePage.getViewport({ scale: 1, rotation: pageRotation(page, sourcePage) });
    const availableWidth = Math.max(120, wrap.clientWidth - 30);
    const availableHeight = Math.max(120, wrap.clientHeight - 30);
    const fit = Math.min(availableWidth / base.width, availableHeight / base.height);
    const viewport = sourcePage.getViewport({ scale: Math.max(.1, fit * zoom), rotation: pageRotation(page, sourcePage) });
    const canvas = $('pdfProCanvas');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    previewRenderTask = sourcePage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
    await previewRenderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') setError(error.message || text().failed);
  } finally {
    previewRenderTask = null;
  }
}

function updateCounter() {
  if (!manifest?.pages.length) return;
  const pageNumber = Math.max(1, currentIndex() + 1);
  const prefix = selectedPageIds.size > 1 ? `${selectedPageIds.size} ${text().selected} · ` : '';
  $('pdfProCounter').textContent = `${prefix}${text().page} ${pageNumber} ${text().of} ${manifest.pages.length}`;
}

function updateControls() {
  const hasDocument = Boolean(manifest);
  const selectionCount = selectedPageIds.size;
  $('pdfProAdd').disabled = busy || !hasDocument;
  $('pdfProReplace').disabled = busy || selectionCount !== 1;
  $('pdfProRotate').disabled = busy || selectionCount < 1;
  $('pdfProDelete').disabled = busy || selectionCount < 1 || selectionCount >= (manifest?.pages.length || 0);
  $('pdfProExtract').disabled = busy || selectionCount < 1;
  $('pdfProUndo').disabled = busy || !manifest?.canUndo;
  $('pdfProRedo').disabled = busy || !manifest?.canRedo;
  $('pdfProSave').disabled = busy || !hasDocument;
  $('pdfProPrevious').disabled = busy || currentIndex() <= 0;
  $('pdfProNext').disabled = busy || currentIndex() >= (manifest?.pages.length || 0) - 1;
  $('pdfProDirty').classList.toggle('hidden', !manifest?.dirty);
}

function buildThumbnails() {
  thumbnailObserver?.disconnect();
  const container = $('pdfProThumbnails');
  container.replaceChildren();
  thumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const page = manifest?.pages.find((item) => item.id === entry.target.dataset.pageId);
        if (page) renderThumbnail(entry.target, page);
      }
    }
  }, { root: container, rootMargin: '180px 0px' });

  manifest.pages.forEach((page, index) => {
    const button = document.createElement('button');
    button.className = `pdf-pro-page${selectedPageIds.has(page.id) ? ' selected' : ''}${page.id === currentPageId ? ' current' : ''}`;
    button.dataset.pageId = page.id;
    button.type = 'button';
    button.role = 'option';
    button.draggable = true;
    button.setAttribute('aria-selected', selectedPageIds.has(page.id) ? 'true' : 'false');
    button.setAttribute('aria-label', `${text().page} ${index + 1}`);
    button.tabIndex = page.id === currentPageId ? 0 : -1;
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-pro-thumb-canvas';
    const number = document.createElement('span');
    number.className = 'pdf-pro-page-number';
    number.textContent = String(index + 1);
    button.append(canvas, number);
    container.append(button);
    thumbnailObserver.observe(button);
  });
}

function applyManifest(nextManifest, options = {}) {
  manifest = nextManifest;
  const validIds = new Set(manifest.pages.map((page) => page.id));
  selectedPageIds = new Set([...selectedPageIds].filter((id) => validIds.has(id)));
  if (!validIds.has(currentPageId)) currentPageId = manifest.pages[0]?.id || null;
  if (!selectedPageIds.size && currentPageId) selectedPageIds.add(currentPageId);
  anchorPageId = validIds.has(anchorPageId) ? anchorPageId : currentPageId;
  $('pdfProName').textContent = manifest.name;
  buildThumbnails();
  updateCounter();
  updateControls();
  if (options.resetSources) destroySources();
  renderPreview();
}

function selectPage(pageId, event = {}) {
  if (!manifest) return;
  const pageIndex = manifest.pages.findIndex((page) => page.id === pageId);
  const anchorIndex = manifest.pages.findIndex((page) => page.id === anchorPageId);
  if (event.shiftKey && anchorIndex >= 0) {
    selectedPageIds = new Set(manifest.pages.slice(Math.min(anchorIndex, pageIndex), Math.max(anchorIndex, pageIndex) + 1).map((page) => page.id));
  } else if (event.metaKey || event.ctrlKey) {
    if (selectedPageIds.has(pageId) && selectedPageIds.size > 1) selectedPageIds.delete(pageId);
    else selectedPageIds.add(pageId);
    anchorPageId = pageId;
  } else {
    selectedPageIds = new Set([pageId]);
    anchorPageId = pageId;
  }
  currentPageId = pageId;
  buildThumbnails();
  updateCounter();
  updateControls();
  renderPreview();
}

async function openDocument() {
  if (busy) return;
  setError();
  setBusy(true, text().opening);
  try {
    const opened = await window.pantoraya.pdfProOpen();
    if (!opened) return;
    destroySources();
    selectedPageIds = new Set();
    currentPageId = opened.pages[0]?.id || null;
    outputPath = null;
    $('pdfProEmpty').classList.add('hidden');
    $('pdfProEditor').classList.remove('hidden');
    applyManifest(opened, { resetSources: true });
  } catch (error) {
    setError(error.message || text().failed);
  } finally {
    setBusy(false);
  }
}

async function command(commandValue) {
  if (!manifest || busy) return;
  setError();
  try {
    applyManifest(await window.pantoraya.pdfProCommand(manifest.sessionId, commandValue));
  } catch (error) { setError(error.message || text().failed); }
}

async function importPages(replace = false) {
  if (!manifest || busy) return;
  setError();
  try {
    const index = Math.max(0, currentIndex() + 1);
    const next = await window.pantoraya.pdfProImport(manifest.sessionId, replace
      ? { replacePageId: currentPageId }
      : { insertIndex: index });
    if (next) applyManifest(next);
  } catch (error) { setError(error.message || text().failed); }
}

async function saveCopy(extract = false) {
  if (!manifest || busy) return;
  setError();
  outputPath = null;
  setBusy(true, extract ? text().extracting : text().saving);
  $('pdfProProgressBar').style.width = '0%';
  try {
    const result = extract
      ? await window.pantoraya.pdfProExtract(manifest.sessionId, [...selectedPageIds])
      : await window.pantoraya.pdfProExport(manifest.sessionId);
    if (!result) {
      setBusy(false);
      return;
    }
    outputPath = result.outputPath;
    if (!extract && result.manifest) applyManifest(result.manifest);
    setBusy(false, text().saved);
    $('pdfProCancel').classList.add('hidden');
  } catch (error) {
    setBusy(false);
    setError(error.message || text().failed);
  }
}

async function closeSession(skipPrompt = false) {
  if (!manifest) return true;
  const closed = await window.pantoraya.pdfProCloseSession(manifest.sessionId, skipPrompt);
  if (!closed) return false;
  thumbnailObserver?.disconnect();
  previewToken += 1;
  manifest = null;
  destroySources();
  selectedPageIds = new Set();
  currentPageId = null;
  outputPath = null;
  $('pdfProEditor').classList.add('hidden');
  $('pdfProEmpty').classList.remove('hidden');
  if (fullscreen) {
    fullscreen = await window.pantoraya.pdfProToggleFullscreen();
  }
  setError();
  return true;
}

function moveCurrent(delta) {
  const index = currentIndex();
  const next = manifest?.pages[index + delta];
  if (!next) return;
  selectPage(next.id);
  document.querySelector(`[data-page-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function applyLanguage(nextLanguage) {
  language = TEXT[nextLanguage] ? nextLanguage : 'es';
  const value = text();
  $('pdfProEmptyTitle').textContent = value.emptyTitle;
  $('pdfProEmptyHint').textContent = value.emptyHint;
  $('pdfProAdd').textContent = value.add;
  $('pdfProReplace').textContent = value.replace;
  $('pdfProRotate').textContent = value.rotate;
  $('pdfProDelete').textContent = value.remove;
  $('pdfProExtract').textContent = value.extract;
  $('pdfProSave').textContent = value.save;
  $('pdfProCancel').textContent = value.cancel;
  for (const [id, label] of [['pdfProFullscreen', value.fullscreen], ['pdfProClose', value.close], ['pdfProUndo', value.undo], ['pdfProRedo', value.redo], ['pdfProPrevious', value.previous], ['pdfProNext', value.next], ['pdfProZoomOut', value.zoomOut], ['pdfProZoomIn', value.zoomIn]]) {
    $(id).setAttribute('aria-label', label);
    $(id).title = label;
  }
  $('pdfProDirty').setAttribute('aria-label', value.unsaved);
  if (manifest) {
    buildThumbnails();
    updateCounter();
  }
}

$('pdfProEmpty').addEventListener('click', openDocument);
$('pdfProEmpty').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDocument(); }
});

$('pdfProThumbnails').addEventListener('click', (event) => {
  const page = event.target.closest('.pdf-pro-page');
  if (page) selectPage(page.dataset.pageId, event);
});
$('pdfProThumbnails').addEventListener('dblclick', (event) => {
  if (event.target.closest('.pdf-pro-page')) $('pdfProFullscreen').click();
});
$('pdfProThumbnails').addEventListener('dragstart', (event) => {
  const page = event.target.closest('.pdf-pro-page');
  if (!page) return;
  draggedPageIds = selectedPageIds.has(page.dataset.pageId) ? manifest.pages.filter((item) => selectedPageIds.has(item.id)).map((item) => item.id) : [page.dataset.pageId];
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', page.dataset.pageId);
});
$('pdfProThumbnails').addEventListener('dragover', (event) => {
  const page = event.target.closest('.pdf-pro-page');
  if (!page || draggedPageIds.includes(page.dataset.pageId)) return;
  event.preventDefault();
  document.querySelectorAll('.drag-before,.drag-after').forEach((node) => node.classList.remove('drag-before', 'drag-after'));
  const before = event.clientY < page.getBoundingClientRect().top + page.offsetHeight / 2;
  page.classList.add(before ? 'drag-before' : 'drag-after');
});
$('pdfProThumbnails').addEventListener('drop', (event) => {
  const target = event.target.closest('.pdf-pro-page');
  document.querySelectorAll('.drag-before,.drag-after').forEach((node) => node.classList.remove('drag-before', 'drag-after'));
  if (!target || !draggedPageIds.length || draggedPageIds.includes(target.dataset.pageId)) return;
  event.preventDefault();
  const before = event.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
  const moving = manifest.pages.filter((page) => draggedPageIds.includes(page.id));
  const remaining = manifest.pages.filter((page) => !draggedPageIds.includes(page.id));
  let targetIndex = remaining.findIndex((page) => page.id === target.dataset.pageId);
  if (!before) targetIndex += 1;
  remaining.splice(targetIndex, 0, ...moving);
  command({ type: 'reorder', order: remaining.map((page) => page.id) });
  draggedPageIds = [];
});

$('pdfProAdd').addEventListener('click', () => importPages(false));
$('pdfProReplace').addEventListener('click', () => importPages(true));
$('pdfProRotate').addEventListener('click', () => command({ type: 'rotate', pageIds: [...selectedPageIds], delta: 90 }));
$('pdfProDelete').addEventListener('click', () => command({ type: 'delete', pageIds: [...selectedPageIds] }));
$('pdfProExtract').addEventListener('click', () => saveCopy(true));
$('pdfProSave').addEventListener('click', () => saveCopy(false));
$('pdfProUndo').addEventListener('click', async () => { if (manifest && !busy) applyManifest(await window.pantoraya.pdfProUndo(manifest.sessionId)); });
$('pdfProRedo').addEventListener('click', async () => { if (manifest && !busy) applyManifest(await window.pantoraya.pdfProRedo(manifest.sessionId)); });
$('pdfProClose').addEventListener('click', () => closeSession());
$('pdfProFullscreen').addEventListener('click', async () => { fullscreen = await window.pantoraya.pdfProToggleFullscreen(); setTimeout(renderPreview, 180); });
$('pdfProPrevious').addEventListener('click', () => moveCurrent(-1));
$('pdfProNext').addEventListener('click', () => moveCurrent(1));
$('pdfProZoomOut').addEventListener('click', () => { zoom = Math.max(.5, zoom - .25); $('pdfProZoomValue').textContent = `${Math.round(zoom * 100)}%`; renderPreview(); });
$('pdfProZoomIn').addEventListener('click', () => { zoom = Math.min(3, zoom + .25); $('pdfProZoomValue').textContent = `${Math.round(zoom * 100)}%`; renderPreview(); });
$('pdfProCancel').addEventListener('click', () => manifest && window.pantoraya.pdfProCancelExport(manifest.sessionId));
$('pdfProStatusText').addEventListener('click', () => outputPath && window.pantoraya.pdfProShowOutput(outputPath));

window.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('pdf-pro-mode') || !manifest || busy) return;
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    selectedPageIds = new Set(manifest.pages.map((page) => page.id));
    buildThumbnails(); updateCounter(); updateControls();
  } else if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    (event.shiftKey ? $('pdfProRedo') : $('pdfProUndo')).click();
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault(); moveCurrent(-1);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault(); moveCurrent(1);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); $('pdfProDelete').click();
  } else if (event.key === 'Escape' && fullscreen) {
    event.preventDefault(); $('pdfProFullscreen').click();
  }
});

const stopProgress = window.pantoraya.onPdfProProgress(({ sessionId, percent }) => {
  if (manifest?.sessionId !== sessionId) return;
  $('pdfProProgressBar').style.width = `${Math.max(0, Math.min(100, percent))}%`;
});
const stopSaveRequest = window.pantoraya.onPdfProSaveRequested(() => saveCopy(false));
const resizeObserver = new ResizeObserver(() => { if (manifest) renderPreview(); });
resizeObserver.observe($('pdfProCanvasWrap'));

window.pdfPro = {
  enter() { $('pdfProSection').classList.remove('hidden'); },
  async requestLeave() { return closeSession(); },
  setLanguage: applyLanguage
};

applyLanguage(language);
if (document.body.classList.contains('pdf-pro-mode')) window.pdfPro.enter();
window.addEventListener('beforeunload', () => {
  stopProgress();
  stopSaveRequest();
  thumbnailObserver?.disconnect();
  resizeObserver.disconnect();
});
