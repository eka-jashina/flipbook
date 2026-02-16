/**
 * Менеджер загрузки книг
 *
 * Чтение файла выполняется через цепочку fallback'ов для надёжной работы
 * на мобильных устройствах (Android content:// URI из «Загрузок»):
 * 1) file.arrayBuffer() — современный Blob API
 * 2) URL.createObjectURL + fetch — обходной путь через Blob URL
 * 3) FileReader.readAsArrayBuffer — классический вариант
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
    this.bookFileInput.addEventListener('change', (e) => this._handleFileChange(e));

    this.bookDropzone.addEventListener('click', () => {
      this.bookFileInput.click();
    });

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
      if (file) this._readAndProcess(file);
    });

    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());
  }

  _handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._readAndProcess(file);
  }

  /**
   * Прочитать файл и обработать.
   * Использует цепочку fallback'ов для надёжного чтения на мобильных устройствах.
   */
  async _readAndProcess(file) {
    const fileName = file.name;

    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    let buffer;
    try {
      buffer = await this._readFileAsArrayBuffer(file);
    } catch (err) {
      this._module._showToast(`Ошибка чтения файла: ${err.message || 'неизвестная ошибка'}`);
      this.bookFileInput.value = '';
      return;
    }

    this._processBuffer(buffer, fileName);
  }

  /**
   * Прочитать файл как ArrayBuffer с fallback для мобильных устройств.
   * На Android FileReader может не справиться с content:// URI для файлов
   * из «Загрузок», поэтому используем цепочку fallback'ов.
   * @param {File} file
   * @returns {Promise<ArrayBuffer>}
   */
  async _readFileAsArrayBuffer(file) {
    // 1) Современный API: Blob.arrayBuffer()
    if (typeof file.arrayBuffer === 'function') {
      try {
        return await file.arrayBuffer();
      } catch { /* fallback */ }
    }

    // 2) Обходной путь: blob URL + fetch (другой путь чтения в браузере)
    if (typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(file);
      try {
        const response = await fetch(url);
        return await response.arrayBuffer();
      } catch { /* fallback */ } finally {
        URL.revokeObjectURL(url);
      }
    }

    // 3) FileReader как последний вариант
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Обработка буфера — парсинг и показ результата.
   */
  async _processBuffer(buffer, fileName) {
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(buffer, fileName);
      this._pendingParsedBook = parsed;

      this.bookDropzone.hidden = true;
      this.bookUploadProgress.hidden = true;
      this.bookUploadResult.hidden = false;
      this.bookUploadTitle.textContent = parsed.title || 'Без названия';
      this.bookUploadAuthor.textContent = parsed.author ? `Автор: ${parsed.author}` : '';
      this.bookUploadChaptersCount.textContent = `Найдено глав: ${parsed.chapters.length}`;
    } catch (err) {
      this._module._showToast(`Ошибка: ${err.message}`);
      this._resetBookUpload();
    } finally {
      this.bookFileInput.value = '';
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
