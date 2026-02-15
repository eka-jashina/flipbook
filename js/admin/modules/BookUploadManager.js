/**
 * Менеджер загрузки книг
 *
 * Чтение файла через FileReader (не async file.arrayBuffer()) —
 * на мобильных Android/iOS File handle из SAF content:// URI
 * может стать невалидным после микротаска/await.
 * FileReader.readAsArrayBuffer() инициирует чтение синхронно
 * в том же вызове event handler, что сохраняет доступ к файлу.
 *
 * После буферизации создаётся новый File([buffer], name) —
 * полностью в памяти, без зависимости от файловой системы.
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
    // Важно: НЕ async-обработчик. FileReader стартует синхронно.
    this.bookFileInput.addEventListener('change', (e) => this._handleFileChange(e));

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
  }

  /**
   * Обработчик change на input[type=file].
   * НЕ async — FileReader.readAsArrayBuffer() вызывается синхронно,
   * в том же стеке что и event handler. Это критично для мобильных
   * браузеров, где File handle может стать невалидным после await.
   */
  _handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._bufferAndProcess(file);
  }

  /**
   * Прочитать файл в память через FileReader (синхронный старт),
   * затем обработать из буфера.
   */
  _bufferAndProcess(file) {
    const fileName = file.name;
    const fileType = file.type;

    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    // FileReader — старейший и самый совместимый API для чтения файлов.
    // readAsArrayBuffer() инициируется синхронно в текущем стеке вызовов.
    // На мобильных браузерах это сохраняет доступ к content:// URI,
    // который может стать невалидным после await/microtask boundary.
    const reader = new FileReader();

    reader.onload = () => {
      const buffer = reader.result;
      // Создаём новый File из буфера — полностью в памяти,
      // без ссылки на файловую систему / SAF content:// URI.
      const memoryFile = new File([buffer], fileName, {
        type: fileType || 'application/octet-stream',
      });
      this._processBufferedFile(memoryFile);
    };

    reader.onerror = () => {
      const msg = reader.error?.message || 'неизвестная ошибка';
      this._module._showToast(`Ошибка чтения файла: ${msg}`);
      this.bookFileInput.value = '';
    };

    // Старт чтения — синхронный вызов, запускает I/O до выхода из handler
    reader.readAsArrayBuffer(file);
  }

  /**
   * Обработка файла, уже прочитанного в память (File из ArrayBuffer).
   */
  async _processBufferedFile(memoryFile) {
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(memoryFile);
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
