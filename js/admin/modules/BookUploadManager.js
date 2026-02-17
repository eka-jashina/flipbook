/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store.
 *
 * В Capacitor (Android) использует нативный плагин BookImport
 * для выбора файла через SAF, обходя ограничения Scoped Storage.
 */

import { BookParser } from '../BookParser.js';

export class BookUploadManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._pendingParsedBook = null;
  }

  get store() { return this._module.store; }

  /**
   * Проверка: работаем ли внутри Capacitor на нативной платформе
   */
  static get isNative() {
    return typeof window !== 'undefined'
      && window.Capacitor
      && window.Capacitor.isNativePlatform();
  }

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

    this._injectNativeButton();
  }

  bindEvents() {
    this.bookDropzone.addEventListener('click', () => this.bookFileInput.click());
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

    if (this._nativePickBtn) {
      this._nativePickBtn.addEventListener('click', () => this._pickFileNative());
    }
  }

  /**
   * Вставляет кнопку нативного выбора файла, если запущено в Capacitor
   */
  _injectNativeButton() {
    if (!BookUploadManager.isNative || !this.bookUploadArea) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary book-upload-native-btn';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>' +
      '</svg> Выбрать файл из памяти';

    // Вставляем перед dropzone
    this.bookUploadArea.insertBefore(btn, this.bookDropzone);
    this._nativePickBtn = btn;

    // Прячем стандартный dropzone (drag&drop не работает в WebView)
    this.bookDropzone.hidden = true;
  }

  /**
   * Выбор файла через нативный плагин BookImport (SAF)
   */
  async _pickFileNative() {
    try {
      const BookImport = window.Capacitor.Plugins.BookImport;
      const result = await BookImport.pickFile();

      if (result.cancelled) return;

      const { base64, fileName, mimeType } = result;
      const file = this._base64ToFile(base64, fileName, mimeType);
      await this._processBookFile(file);
    } catch (err) {
      this._module._showToast(`Ошибка выбора файла: ${err.message}`);
    }
  }

  /**
   * Конвертация base64-строки в объект File
   */
  _base64ToFile(base64, fileName, mimeType) {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mimeType || 'application/octet-stream' });
  }

  _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._processBookFile(file);
    e.target.value = '';
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    if (this._nativePickBtn) this._nativePickBtn.hidden = true;
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
    if (this._nativePickBtn) this._nativePickBtn.hidden = false;
    this.bookDropzone.hidden = BookUploadManager.isNative;
    this.bookUploadProgress.hidden = true;
    this.bookUploadResult.hidden = true;
  }
}
