/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 *
 * На Android Chrome файлы, выбранные через <input type="file">,
 * могут быть нечитаемыми (NotFoundError) из-за проблем с content:// URI
 * в Storage Access Framework. FileReader и file.arrayBuffer() оба
 * подвержены этому багу.
 *
 * showOpenFilePicker (File System Access API) НЕ используется —
 * на Android он открывает полноэкранную Activity, Android убивает
 * вкладку (белый экран), и после восстановления файл тоже нечитаем.
 *
 * Решение:
 * 1. Input[type=file] как прозрачный оверлей поверх dropzone —
 *    нативный клик, без программного .click(), минимальная вероятность
 *    убийства вкладки.
 * 2. URL.createObjectURL(file) + fetch() для чтения — использует
 *    другой код-путь в Chromium и обходит баг SAF.
 *    Каскадный fallback: arrayBuffer → FileReader.
 */

import { BookParser } from '../BookParser.js';

const SUPPORTED_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

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
    // Input[type=file] — прозрачный оверлей поверх dropzone (position:absolute
    // в HTML). Пользователь кликает прямо на input, файловый пикер открывается
    // нативно без программного .click() и без showOpenFilePicker.
    // showOpenFilePicker НЕ используется: на Android он открывает полноэкранную
    // Activity → Android убивает вкладку → белый экран.
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

    // Восстановление после Android page kill: если браузер восстановил
    // страницу и input уже содержит файл (browser form restoration)
    if (this.bookFileInput.files && this.bookFileInput.files.length > 0) {
      Promise.resolve().then(() => this._handleInputChange({ target: this.bookFileInput }));
    }
  }

  /**
   * Обработчик change на input[type=file].
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
