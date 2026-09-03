const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PDFDocument, degrees } = require('pdf-lib');

const IMPORT_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

function clonePages(pages) {
  return pages.map((page) => ({ ...page }));
}

function normalizeRotation(value) {
  return ((Number(value) % 360) + 360) % 360;
}

class PdfProSessionManager {
  constructor() {
    this.sessions = new Map();
    this.cancelledExports = new Set();
  }

  async create(filePath) {
    const session = {
      id: randomUUID(),
      name: path.basename(filePath),
      originalPath: filePath,
      sources: new Map(),
      pages: [],
      history: [],
      future: [],
      savedSignature: '',
      dirty: false
    };
    const source = await this.#loadSource(filePath);
    session.sources.set(source.id, source);
    session.pages = this.#pagesForSource(source);
    session.savedSignature = this.#signature(session.pages);
    this.sessions.set(session.id, session);
    return this.manifest(session.id);
  }

  close(sessionId) {
    return this.sessions.delete(sessionId);
  }

  manifest(sessionId) {
    const session = this.#session(sessionId);
    return {
      sessionId: session.id,
      name: session.name,
      pageCount: session.pages.length,
      pages: clonePages(session.pages),
      canUndo: session.history.length > 0,
      canRedo: session.future.length > 0,
      dirty: session.dirty
    };
  }

  sourceBytes(sessionId, sourceId) {
    const source = this.#source(sessionId, sourceId);
    return Uint8Array.from(source.bytes);
  }

  apply(sessionId, command) {
    const session = this.#session(sessionId);
    if (!command || typeof command !== 'object') throw new Error('Invalid PDF command.');
    const before = clonePages(session.pages);
    const ids = Array.isArray(command.pageIds) ? new Set(command.pageIds.filter((id) => typeof id === 'string')) : new Set();

    if (command.type === 'rotate') {
      const delta = Number(command.delta);
      if (![90, -90, 180].includes(delta) || !ids.size) throw new Error('Invalid rotation.');
      session.pages = session.pages.map((page) => ids.has(page.id)
        ? { ...page, rotation: normalizeRotation(page.rotation + delta) }
        : page);
    } else if (command.type === 'delete') {
      if (!ids.size || ids.size >= session.pages.length) throw new Error('A PDF must keep at least one page.');
      session.pages = session.pages.filter((page) => !ids.has(page.id));
    } else if (command.type === 'reorder') {
      if (!Array.isArray(command.order) || command.order.length !== session.pages.length) throw new Error('Invalid page order.');
      const byId = new Map(session.pages.map((page) => [page.id, page]));
      if (new Set(command.order).size !== session.pages.length || command.order.some((id) => !byId.has(id))) throw new Error('Invalid page order.');
      session.pages = command.order.map((id) => byId.get(id));
    } else {
      throw new Error('Unsupported PDF command.');
    }

    this.#record(session, before);
    return this.manifest(sessionId);
  }

  undo(sessionId) {
    const session = this.#session(sessionId);
    const previous = session.history.pop();
    if (!previous) return this.manifest(sessionId);
    session.future.push(clonePages(session.pages));
    session.pages = previous;
    this.#updateDirty(session);
    return this.manifest(sessionId);
  }

  redo(sessionId) {
    const session = this.#session(sessionId);
    const next = session.future.pop();
    if (!next) return this.manifest(sessionId);
    session.history.push(clonePages(session.pages));
    session.pages = next;
    this.#updateDirty(session);
    return this.manifest(sessionId);
  }

  async import(sessionId, filePaths, insertIndex, replacePageId = null) {
    const session = this.#session(sessionId);
    if (!Array.isArray(filePaths) || !filePaths.length) throw new Error('No compatible file was selected.');
    const before = clonePages(session.pages);
    const imported = [];
    for (const filePath of filePaths) {
      const source = await this.#loadSource(filePath);
      session.sources.set(source.id, source);
      imported.push(...this.#pagesForSource(source));
    }
    if (!imported.length) throw new Error('The selected file has no pages.');

    if (replacePageId) {
      const target = session.pages.findIndex((page) => page.id === replacePageId);
      if (target < 0) throw new Error('The selected page no longer exists.');
      session.pages.splice(target, 1, imported[0]);
    } else {
      const index = Math.max(0, Math.min(Number(insertIndex) || 0, session.pages.length));
      session.pages.splice(index, 0, ...imported);
    }
    this.#record(session, before);
    return this.manifest(sessionId);
  }

  async export(sessionId, outputPath, pageIds, onProgress = () => {}) {
    const session = this.#session(sessionId);
    const selection = Array.isArray(pageIds) && pageIds.length
      ? new Set(pageIds)
      : null;
    const pages = selection ? session.pages.filter((page) => selection.has(page.id)) : session.pages;
    if (!pages.length) throw new Error('No pages were selected.');

    this.cancelledExports.delete(sessionId);
    const output = await PDFDocument.create();
    output.setProducer('Pantoraya PDF Pro');
    output.setCreator('Pantoraya');
    for (let index = 0; index < pages.length; index += 1) {
      if (this.cancelledExports.has(sessionId)) throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' });
      const page = pages[index];
      const source = this.#source(sessionId, page.sourceId);
      const [copied] = await output.copyPages(source.document, [page.sourcePageIndex]);
      copied.setRotation(degrees(normalizeRotation(page.rotation)));
      output.addPage(copied);
      onProgress(Math.round(((index + 1) / (pages.length + 1)) * 90));
    }
    const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 25 });
    if (this.cancelledExports.has(sessionId)) throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' });
    onProgress(95);
    const temporaryPath = `${outputPath}.pantoraya-${process.pid}-${Date.now()}.tmp`;
    try {
      await fs.promises.writeFile(temporaryPath, bytes);
      await fs.promises.rename(temporaryPath, outputPath);
    } finally {
      await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
      this.cancelledExports.delete(sessionId);
    }
    onProgress(100);
    if (!selection) {
      session.savedSignature = this.#signature(session.pages);
      session.dirty = false;
    }
    return { outputPath, outputBytes: bytes.length, manifest: this.manifest(sessionId) };
  }

  cancelExport(sessionId) {
    if (!this.sessions.has(sessionId)) return false;
    this.cancelledExports.add(sessionId);
    return true;
  }

  #record(session, before) {
    session.history.push(before);
    if (session.history.length > 100) session.history.shift();
    session.future = [];
    this.#updateDirty(session);
  }

  #signature(pages) {
    return pages.map((page) => `${page.id}:${normalizeRotation(page.rotation)}`).join('|');
  }

  #updateDirty(session) {
    session.dirty = this.#signature(session.pages) !== session.savedSignature;
  }

  #session(sessionId) {
    if (typeof sessionId !== 'string' || !this.sessions.has(sessionId)) throw new Error('PDF session expired.');
    return this.sessions.get(sessionId);
  }

  #source(sessionId, sourceId) {
    const source = this.#session(sessionId).sources.get(sourceId);
    if (!source) throw new Error('PDF source is unavailable.');
    return source;
  }

  async #loadSource(filePath) {
    if (typeof filePath !== 'string' || !fs.existsSync(filePath) || !IMPORT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      throw new Error('Unsupported PDF Pro file.');
    }
    const extension = path.extname(filePath).toLowerCase();
    const input = await fs.promises.readFile(filePath);
    let bytes = input;
    let document;
    try {
      if (extension === '.pdf') {
        document = await PDFDocument.load(input, { updateMetadata: false });
      } else {
        document = await PDFDocument.create();
        const image = extension === '.png' ? await document.embedPng(input) : await document.embedJpg(input);
        const page = document.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        bytes = Buffer.from(await document.save({ useObjectStreams: true }));
        document = await PDFDocument.load(bytes, { updateMetadata: false });
      }
    } catch (error) {
      if (/encrypt/i.test(error.message)) throw Object.assign(new Error('PDF_LOCKED'), { code: 'PDF_LOCKED' });
      throw Object.assign(new Error('PDF_INVALID'), { code: 'PDF_INVALID' });
    }
    if (document.isEncrypted) throw Object.assign(new Error('PDF_LOCKED'), { code: 'PDF_LOCKED' });
    return { id: randomUUID(), path: filePath, name: path.basename(filePath), bytes: Buffer.from(bytes), document };
  }

  #pagesForSource(source) {
    return source.document.getPages().map((page, sourcePageIndex) => {
      const size = page.getSize();
      return {
        id: randomUUID(),
        sourceId: source.id,
        sourcePageIndex,
        width: size.width,
        height: size.height,
        rotation: normalizeRotation(page.getRotation().angle)
      };
    });
  }
}

module.exports = { PdfProSessionManager, IMPORT_EXTENSIONS };
