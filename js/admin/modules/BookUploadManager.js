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
  }

  async _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    await this._processBookFile(file);
    e.target.value = '';
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    // На мобильных браузерах (Android Chrome SAF, iOS Safari) ссылка на File
    // становится невалидной после сброса input или скрытия родительского элемента.
    // Читаем файл в память ДО любых изменений DOM.
    let safeFile;
    try {
      const buffer = await this._readFileToBuffer(file);
      safeFile = new File([buffer], file.name, { type: file.type });
    } catch (err) {
      this._module._showToast(`Ошибка чтения файла: ${err.message}`);
      return;
    }

    this.bookDropzone.hidden = true;
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(safeFile);
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

  /**
   * Прочитать файл в ArrayBuffer, используя наиболее надёжный доступный метод.
   * Каскад стратегий для обхода проблем мобильных браузеров
   * (Android Chrome SAF content:// URI, iOS Safari).
   * @param {File} file
   * @returns {Promise<ArrayBuffer>}
   */
  async _readFileToBuffer(file) {
    // Стратегия 1: createObjectURL + fetch
    // Самый надёжный способ на Android Chrome с SAF content:// URI.
    // createObjectURL захватывает ссылку на файл синхронно.
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      let blobUrl;
      try {
        blobUrl = URL.createObjectURL(file);
        const response = await fetch(blobUrl);
        return await response.arrayBuffer();
      } catch {
        // Переходим к следующей стратегии
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    }

    // Стратегия 2: FileReader (callback API, широкая совместимость)
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
    } catch {
      // Переходим к следующей стратегии
    }

    // Стратегия 3: file.arrayBuffer() (простейший вариант)
    return file.arrayBuffer();
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
