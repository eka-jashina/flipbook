/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store.
 *
 * На Android-браузере обходит ограничения Scoped Storage:
 * - Создаёт свежий <input> без accept-фильтра (избегает сломанных провайдеров)
 * - Буферизует файл сразу после выбора (до истечения content:// URI)
 * - В Capacitor APK использует нативный плагин BookImport через SAF
 */

import { BookParser } from '../BookParser.js';

/** Расширения, которые мы умеем парсить */
const SUPPORTED_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
const ACCEPT_STRING = SUPPORTED_EXTENSIONS.join(', ');

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

  /**
   * Проверка: Android-браузер (НЕ Capacitor APK)
   */
  static get _isAndroidBrowser() {
    return /android/i.test(navigator.userAgent) && !BookUploadManager.isNative;
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

    // На Android убираем accept — он заставляет систему использовать
    // фильтрованный провайдер, который ломается на Scoped Storage
    if (BookUploadManager._isAndroidBrowser && this.bookFileInput) {
      this.bookFileInput.removeAttribute('accept');
    }

    this._injectNativeButton();
  }

  bindEvents() {
    this.bookDropzone.addEventListener('click', () => this._openFilePicker());
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
      if (file) this._bufferAndProcess(file);
    });
    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());

    if (this._nativePickBtn) {
      this._nativePickBtn.addEventListener('click', () => this._pickFileNative());
    }
  }

  /**
   * Открыть системный пикер файлов.
   * На Android — свежий <input> без accept (обход Scoped Storage).
   * На десктопе — обычный <input> с accept-фильтром.
   */
  _openFilePicker() {
    if (BookUploadManager._isAndroidBrowser) {
      // Свежий элемент без accept — Android покажет нефильтрованный пикер,
      // который корректно читает файлы из Downloads / SD-карт
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      input.addEventListener('change', (e) => {
        this._handleBookUpload(e);
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    } else {
      this.bookFileInput.click();
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

  /**
   * Обработка выбора файла через <input type="file">
   */
  _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._bufferAndProcess(file);
    if (e.target === this.bookFileInput) {
      e.target.value = '';
    }
  }

  /**
   * Немедленная буферизация файла и передача на обработку.
   * На Android content:// URI от системного пикера может стать невалидным —
   * читаем содержимое в ArrayBuffer сразу, создаём новый File в памяти.
   */
  async _bufferAndProcess(file) {
    try {
      const buffer = await file.arrayBuffer();
      const bufferedFile = new File([buffer], file.name, { type: file.type });
      await this._processBookFile(bufferedFile);
    } catch {
      if (BookUploadManager._isAndroidBrowser) {
        this._module._showToast(
          'Не удалось прочитать файл. Скопируйте его во внутреннюю память ' +
          '(папка «Документы») и попробуйте снова.'
        );
      } else {
        this._module._showToast(
          'Не удалось прочитать файл. Проверьте, что файл доступен.'
        );
      }
    }
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      this._module._showToast(`Допустимые форматы: ${ACCEPT_STRING}`);
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
