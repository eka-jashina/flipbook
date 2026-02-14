/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 *
 * На Android Chrome файлы, выбранные через <input type="file"> или
 * showOpenFilePicker, могут быть нечитаемыми (NotFoundError) из-за
 * проблем с content:// URI в Storage Access Framework.
 * FileReader и file.arrayBuffer() оба подвержены этому багу.
 *
 * Решение: URL.createObjectURL(file) + fetch() как основной способ
 * чтения — использует другой код-путь в Chromium и обходит баг SAF.
 * При недоступности — каскадный fallback через file.arrayBuffer()
 * и FileReader.
 */

import { BookParser } from '../BookParser.js';

const SUPPORTED_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

const FILE_PICKER_TYPES = [{
  description: 'Книги',
  accept: {
    'application/epub+zip': ['.epub'],
    'application/x-fictionbook+xml': ['.fb2'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'text/plain': ['.txt'],
  },
}];

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
    // На мобильных Android (Chrome) файлы из <input type="file"> могут быть
    // нечитаемыми (NotFoundError) из-за багов Storage Access Framework.
    // showOpenFilePicker (File System Access API) использует другой путь
    // доступа к файлам и обходит эту проблему.
    // Клик по dropzone: пробуем showOpenFilePicker, при неудаче — input.
    this.bookDropzone.addEventListener('click', (e) => {
      // Не перехватываем клик по самому input (он внутри dropzone)
      if (e.target === this.bookFileInput) return;
      this._openFilePicker();
    });
    this.bookFileInput.addEventListener('change', (e) => this._handleInputChange(e));
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

  /**
   * Основной метод выбора файла.
   * Пробуем showOpenFilePicker (File System Access API).
   * Если API недоступен (Firefox, Safari) — открываем обычный input[type=file].
   * Если файл выбран, но чтение не удалось — показываем ошибку сразу,
   * НЕ переключаемся на input (там будет тот же баг SAF).
   */
  async _openFilePicker() {
    if (typeof window.showOpenFilePicker === 'function') {
      let file;
      try {
        const [handle] = await window.showOpenFilePicker({
          types: FILE_PICKER_TYPES,
          multiple: false,
        });
        file = await handle.getFile();
      } catch (err) {
        // AbortError = пользователь отменил выбор
        if (err.name === 'AbortError') return;
        // API не работает — fallback на input
        this.bookFileInput.click();
        return;
      }

      // Файл выбран через picker — читаем с каскадными стратегиями
      try {
        const buffer = await this._readFileBuffer(file);
        const safeFile = new File([buffer], file.name, { type: file.type });
        this._processBookFile(safeFile);
      } catch {
        this._module._showToast(
          'Не удалось прочитать файл. Попробуйте сохранить файл в память устройства (не на SD-карту / облако) и повторить.'
        );
      }
      return;
    }

    // Fallback: обычный input[type=file]
    this.bookFileInput.click();
  }

  /**
   * Обработчик change на input[type=file] — fallback путь.
   * Читаем файл с каскадными стратегиями (createObjectURL+fetch → arrayBuffer → FileReader).
   */
  async _handleInputChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const buffer = await this._readFileBuffer(file);
      const safeFile = new File([buffer], file.name, { type: file.type });
      e.target.value = '';
      this._processBookFile(safeFile);
    } catch {
      e.target.value = '';
      this._module._showToast(
        'Не удалось прочитать файл. Попробуйте сохранить файл в память устройства (не на SD-карту / облако) и повторить.'
      );
    }
  }

  /**
   * Чтение файла в ArrayBuffer с каскадом стратегий.
   *
   * На Android Chrome файлы из SAF (content:// URI) могут быть нечитаемыми
   * через FileReader и file.arrayBuffer() (NotFoundError).
   * URL.createObjectURL + fetch использует другой код-путь в Chromium
   * и обходит эту проблему.
   *
   * Стратегии (по приоритету):
   * 1. createObjectURL + fetch — обходит баги Android SAF
   * 2. file.arrayBuffer() — современный API
   * 3. FileReader — классический fallback
   */
  async _readFileBuffer(file) {
    // Стратегия 1: Blob URL + fetch — обходит баги Android SAF
    if (typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(file);
      try {
        const resp = await fetch(url);
        return await resp.arrayBuffer();
      } catch { /* fall through */ } finally {
        URL.revokeObjectURL(url);
      }
    }

    // Стратегия 2: file.arrayBuffer()
    try {
      return await file.arrayBuffer();
    } catch { /* fall through */ }

    // Стратегия 3: FileReader
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
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

      this.bookUploadProgress.hidden = true;
      this.bookUploadResult.hidden = false;
      this.bookUploadTitle.textContent = parsed.title || 'Без названия';
      this.bookUploadAuthor.textContent = parsed.author ? `Автор: ${parsed.author}` : '';
      this.bookUploadChaptersCount.textContent = `Найдено глав: ${parsed.chapters.length}`;
    } catch (err) {
      this._module._showToast(`Ошибка: ${err.message}`);
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
