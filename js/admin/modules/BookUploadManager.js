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
      alert('[debug] change event сработал, но файл не выбран');
      return;
    }

    const ua = navigator.userAgent;
    const lines = [];
    lines.push(`UA: ${ua}`);
    lines.push(`File: ${file.name}`);
    lines.push(`Size: ${file.size} bytes`);
    lines.push(`Type: "${file.type}"`);
    lines.push(`LastModified: ${file.lastModified}`);
    lines.push(`Constructor: ${file.constructor?.name}`);
    lines.push(`Is File: ${file instanceof File}`);
    lines.push(`Is Blob: ${file instanceof Blob}`);

    // 0) Тест: создаём File в памяти и читаем — работает ли File API вообще?
    const syntheticTest = await new Promise((resolve) => {
      try {
        const fake = new File([new Uint8Array([1, 2, 3])], 'test.bin');
        const r = new FileReader();
        r.onload = () => resolve(`OK (${r.result.byteLength}б)`);
        r.onerror = () => resolve(`FAIL: ${r.error?.name}`);
        r.readAsArrayBuffer(fake);
      } catch (ex) {
        resolve(`THROW: ${ex.message}`);
      }
    });
    lines.push(`Synthetic file read: ${syntheticTest}`);

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
    lines.push(`FR.readAsArrayBuffer: ${frResult.ok ? `OK ${frResult.size}б` : frResult.err}`);

    // 2) file.text()
    const textResult = await file.text().then(
      t => ({ ok: true, len: t.length }),
      ex => ({ ok: false, err: `${ex.name}: ${ex.message}` })
    );
    lines.push(`file.text(): ${textResult.ok ? `OK ${textResult.len}ch` : textResult.err}`);

    // 3) file.slice(0,100) + read
    const sliceResult = await new Promise((resolve) => {
      try {
        const slice = file.slice(0, Math.min(100, file.size));
        const r = new FileReader();
        r.onload = () => resolve({ ok: true, size: r.result.byteLength });
        r.onerror = () => resolve({ ok: false, err: `${r.error?.name}: ${r.error?.message}` });
        r.readAsArrayBuffer(slice);
      } catch (ex) {
        resolve({ ok: false, err: `throw: ${ex.name}: ${ex.message}` });
      }
    });
    lines.push(`slice(0,100): ${sliceResult.ok ? `OK ${sliceResult.size}б` : sliceResult.err}`);

    // 4) createObjectURL + fetch
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
    lines.push(`blobURL+fetch: ${fetchResult.ok ? `OK ${fetchResult.size}б` : fetchResult.err}`);

    // Показываем ВСЕ результаты одним alert — он не исчезнет, пока не нажмут OK
    alert(lines.join('\n'));

    // Пробуем обработать файл первым успешным способом
    let buffer = null;
    if (frResult.ok) buffer = frResult.data;
    else if (fetchResult.ok) {
      const url = URL.createObjectURL(file);
      buffer = await fetch(url).then(r => r.arrayBuffer());
      URL.revokeObjectURL(url);
    }

    e.target.value = '';

    if (buffer) {
      const safeFile = new File([buffer], file.name, { type: file.type });
      this._processBookFile(safeFile);
    } else {
      this._module._showToast('Не удалось прочитать файл. Попробуйте сохранить файл в память устройства и повторить.');
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
