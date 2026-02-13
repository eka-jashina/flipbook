/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 */

import { BookParser } from '../BookParser.js';

export class BookUploadManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._pendingParsedBook = null;
  }

  get store() { return this._module.store; }

  cacheDOM() {
    this.bookUploadArea = document.getElementById('bookUploadArea');
    this.bookDropzone = document.getElementById('bookDropzone');
    this.bookFileInput = document.getElementById('bookFileInput');
    this.bookUploadProgress = document.getElementById('bookUploadProgress');
    this.bookUploadStatus = document.getElementById('bookUploadStatus');
    this.bookUploadResult = document.getElementById('bookUploadResult');
    this.bookUploadTitle = document.getElementById('bookUploadTitle');
    this.bookUploadAuthor = document.getElementById('bookUploadAuthor');
    this.bookUploadChaptersCount = document.getElementById('bookUploadChaptersCount');
    this.bookUploadConfirm = document.getElementById('bookUploadConfirm');
    this.bookUploadCancel = document.getElementById('bookUploadCancel');
  }

  bindEvents() {
    // Клик по dropzone открывает пикер нативно через <label for="bookFileInput">.
    // Программный .click() не используется — на мобильных он создаёт
    // нестабильную файловую ссылку, что приводит к NotFoundError при чтении.
    this.bookFileInput.addEventListener('change', (e) => this._handleBookUpload(e));
    this.bookDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.bookDropzone.classList.add('dragover');
    });
    this.bookDropzone.addEventListener('dragleave', () => {
      this.bookDropzone.classList.remove('dragover');
    });
    this.bookDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.bookDropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this._processBookFile(file);
    });
    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());
  }

  async _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) {
      this._module._showToast('[debug] change: файл не выбран');
      return;
    }

    const ua = navigator.userAgent;
    const browser = /CriOS/.test(ua) ? 'Chrome iOS'
      : /FxiOS/.test(ua) ? 'Firefox iOS'
      : /Safari/.test(ua) && /iPhone|iPad/.test(ua) ? 'Safari iOS'
      : /Chrome/.test(ua) && /Android/.test(ua) ? 'Chrome Android'
      : ua.slice(0, 50);

    const toast = (msg) => this._module._showToast(msg);

    toast(`[info] ${browser} | ${file.name} | ${file.size}б | type="${file.type}"`);

    // Пробуем все способы чтения — находим, что работает
    const results = [];

    // 1) FileReader.readAsArrayBuffer
    const frResult = await new Promise((resolve) => {
      try {
        const r = new FileReader();
        r.onload = () => resolve({ ok: true, size: r.result.byteLength, data: r.result });
        r.onerror = () => resolve({ ok: false, err: `${r.error?.name}: ${r.error?.message}` });
        r.readAsArrayBuffer(file);
      } catch (ex) {
        resolve({ ok: false, err: `throw: ${ex.name}: ${ex.message}` });
      }
    });
    results.push(`FR.arrayBuf: ${frResult.ok ? `OK ${frResult.size}б` : frResult.err}`);

    // 2) FileReader.readAsDataURL
    const frDataUrl = await new Promise((resolve) => {
      try {
        const r = new FileReader();
        r.onload = () => resolve({ ok: true, len: r.result.length });
        r.onerror = () => resolve({ ok: false, err: `${r.error?.name}: ${r.error?.message}` });
        r.readAsDataURL(file);
      } catch (ex) {
        resolve({ ok: false, err: `throw: ${ex.name}: ${ex.message}` });
      }
    });
    results.push(`FR.dataURL: ${frDataUrl.ok ? `OK ${frDataUrl.len}ch` : frDataUrl.err}`);

    // 3) file.text()
    const textResult = await file.text().then(
      t => ({ ok: true, len: t.length }),
      ex => ({ ok: false, err: `${ex.name}: ${ex.message}` })
    );
    results.push(`file.text: ${textResult.ok ? `OK ${textResult.len}ch` : textResult.err}`);

    // 4) file.arrayBuffer()
    const abResult = await file.arrayBuffer().then(
      buf => ({ ok: true, size: buf.byteLength }),
      ex => ({ ok: false, err: `${ex.name}: ${ex.message}` })
    );
    results.push(`file.arrayBuf: ${abResult.ok ? `OK ${abResult.size}б` : abResult.err}`);

    // 5) file.slice + read (маленький кусочек)
    const sliceResult = await new Promise((resolve) => {
      try {
        const slice = file.slice(0, 100);
        const r = new FileReader();
        r.onload = () => resolve({ ok: true, size: r.result.byteLength });
        r.onerror = () => resolve({ ok: false, err: `${r.error?.name}: ${r.error?.message}` });
        r.readAsArrayBuffer(slice);
      } catch (ex) {
        resolve({ ok: false, err: `throw: ${ex.name}: ${ex.message}` });
      }
    });
    results.push(`slice(100): ${sliceResult.ok ? `OK ${sliceResult.size}б` : sliceResult.err}`);

    // 6) createObjectURL + fetch
    const fetchResult = await (async () => {
      try {
        const url = URL.createObjectURL(file);
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        URL.revokeObjectURL(url);
        return { ok: true, size: buf.byteLength };
      } catch (ex) {
        return { ok: false, err: `${ex.name}: ${ex.message}` };
      }
    })();
    results.push(`blobURL: ${fetchResult.ok ? `OK ${fetchResult.size}б` : fetchResult.err}`);

    // Показываем результаты (по 2 на toast, чтобы поместились)
    for (let i = 0; i < results.length; i += 2) {
      toast(results.slice(i, i + 2).join(' | '));
    }

    // Пробуем обработать файл первым успешным способом
    let buffer = null;
    if (frResult.ok) buffer = frResult.data;
    else if (abResult.ok) buffer = await file.arrayBuffer();
    else if (fetchResult.ok) {
      const url = URL.createObjectURL(file);
      buffer = await fetch(url).then(r => r.arrayBuffer());
      URL.revokeObjectURL(url);
    }

    e.target.value = '';

    if (buffer) {
      toast(`[OK] Используем буфер ${buffer.byteLength}б`);
      const safeFile = new File([buffer], file.name, { type: file.type });
      this._processBookFile(safeFile);
    } else {
      toast('[FAIL] Ни один способ чтения не сработал');
    }
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    this.bookDropzone.hidden = true;
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(file);
      this._pendingParsedBook = parsed;

      this._module._showToast(`[3/3] Парсинг ОК: «${parsed.title}», ${parsed.chapters.length} гл.`);

      this.bookUploadProgress.hidden = true;
      this.bookUploadResult.hidden = false;
      this.bookUploadTitle.textContent = parsed.title || 'Без названия';
      this.bookUploadAuthor.textContent = parsed.author ? `Автор: ${parsed.author}` : '';
      this.bookUploadChaptersCount.textContent = `Найдено глав: ${parsed.chapters.length}`;
    } catch (err) {
      this._module._showToast(`[ОШИБКА] Парсинг: ${err.name}: ${err.message}`);
      this._resetBookUpload();
    }
  }

  async _applyParsedBook() {
    if (!this._pendingParsedBook) return;

    const { title, author, chapters } = this._pendingParsedBook;

    const newChapters = chapters.map(ch => ({
      id: ch.id,
      file: '',
      htmlContent: ch.html,
      bg: '',
      bgMobile: '',
    }));

    const bookId = `book_${Date.now()}`;

    this.store.addBook({
      id: bookId,
      cover: {
        title: title || 'Без названия',
        author: author || '',
        bg: '',
        bgMobile: '',
      },
      chapters: newChapters,
    });

    try {
      await this.store.waitForSave();
    } catch {
      this.store.removeBook(bookId);
      this._module._showToast('Ошибка сохранения: недостаточно места в хранилище');
      return;
    }

    this.store.setActiveBook(bookId);

    this._module.app._render();
    this._resetBookUpload();
    this._module._showToast(`Книга «${title || 'Без названия'}» добавлена (${chapters.length} гл.)`);

    // Открыть редактор загруженной книги
    this._module.app.openEditor();
  }

  _resetBookUpload() {
    this._pendingParsedBook = null;
    this.bookDropzone.hidden = false;
    this.bookUploadProgress.hidden = true;
    this.bookUploadResult.hidden = true;
  }
}
