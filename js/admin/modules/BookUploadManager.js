/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 *
 * На Android 10+ Chrome файлы, выбранные через <input type="file">,
 * могут быть нечитаемыми (NotFoundError) из-за проблем с content:// URI
 * в Storage Access Framework. Поэтому используется File System Access API
 * (showOpenFilePicker) как основной способ — он работает через другой
 * механизм доступа к файлам и обходит эту проблему.
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
   * Пробуем showOpenFilePicker (File System Access API) — он обходит
   * баг Android SAF с нечитаемыми content:// URI.
   * Если API недоступен — открываем обычный input[type=file].
   */
  async _openFilePicker() {
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: FILE_PICKER_TYPES,
          multiple: false,
        });
        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        const safeFile = new File([buffer], file.name, { type: file.type });
        this._processBookFile(safeFile);
        return;
      } catch (err) {
        // AbortError = пользователь отменил выбор — просто выходим
        if (err.name === 'AbortError') return;
        // Другая ошибка — пробуем fallback через input
      }
    }

    // Fallback: обычный input[type=file]
    this.bookFileInput.click();
  }

  /**
   * Обработчик change на input[type=file] — fallback путь.
   * Читаем файл через FileReader синхронно в обработчике события.
   * Если чтение не удаётся (Android SAF баг) — показываем ошибку.
   */
  _handleInputChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const safeFile = new File([reader.result], file.name, { type: file.type });
      e.target.value = '';
      this._processBookFile(safeFile);
    };
    reader.onerror = () => {
      e.target.value = '';
      this._module._showToast(
        'Не удалось прочитать файл. Попробуйте сохранить файл в память устройства (не на SD-карту / облако) и повторить.'
      );
    };
    reader.readAsArrayBuffer(file);
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
