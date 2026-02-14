/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 *
 * Мобильная совместимость:
 * - <input> вынесен из dropzone (скрытие dropzone не инвалидирует File)
 * - <label for="..."> вместо JS click() (нативный триггер на мобильных)
 * - visually-hidden вместо display:none (мобильные браузеры сохраняют File handle)
 * - FileReader инициирует чтение синхронно внутри event handler
 * - createObjectURL+fetch как fallback для Android SAF content:// URI
 */

import { BookParser } from '../BookParser.js';

const SUPPORTED_FORMATS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

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
    // Dropzone — это <label for="bookFileInput">, клик открывает файловый диалог
    // нативно через браузер, без программного click(). Это ключевое отличие
    // для мобильных браузеров, где programmatic click() на hidden input ненадёжен.

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
      if (file) this._handleDroppedFile(file);
    });
    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());
  }

  /**
   * Обработка выбора файла через <input type="file">.
   * Ключевой принцип: инициируем чтение файла СИНХРОННО внутри event handler,
   * ДО любых await/async — чтобы File handle гарантированно оставался валидным.
   * FileReader.readAsArrayBuffer() начинает чтение немедленно.
   */
  _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      e.target.value = '';
      return;
    }

    // Сохраняем свойства файла синхронно — они могут стать недоступны позже
    const fileName = file.name;
    const fileType = file.type;

    // Стратегия 1: FileReader — начинает чтение СИНХРОННО в контексте event handler.
    // Это самый надёжный способ: браузер не может освободить file handle
    // пока идёт активное чтение через FileReader.
    const reader = new FileReader();

    reader.onload = () => {
      // Данные в памяти. Безопасно сбросить input.
      e.target.value = '';
      const safeFile = new File([reader.result], fileName, { type: fileType });
      this._processBookFile(safeFile);
    };

    reader.onerror = () => {
      // FileReader не смог прочитать — пробуем fallback через createObjectURL+fetch.
      // Это работает на Android Chrome с SAF content:// URI в некоторых случаях,
      // где FileReader отказывает.
      this._readWithFetchFallback(file, fileName, fileType)
        .then(safeFile => {
          e.target.value = '';
          this._processBookFile(safeFile);
        })
        .catch(err => {
          e.target.value = '';
          this._module._showToast(`Ошибка чтения файла: ${err.message}`);
        });
    };

    // Начать чтение НЕМЕДЛЕННО — синхронный вызов внутри event handler
    reader.readAsArrayBuffer(file);
  }

  /**
   * Обработка файла из drag-and-drop.
   * Drop файлы обычно стабильнее (они уже в памяти браузера),
   * но всё равно буферизуем для единообразия.
   */
  _handleDroppedFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    const fileName = file.name;
    const fileType = file.type;

    const reader = new FileReader();
    reader.onload = () => {
      const safeFile = new File([reader.result], fileName, { type: fileType });
      this._processBookFile(safeFile);
    };
    reader.onerror = () => {
      // Drop файлы обычно стабильны, но на всякий случай — fallback
      this._readWithFetchFallback(file, fileName, fileType)
        .then(safeFile => this._processBookFile(safeFile))
        .catch(err => this._module._showToast(`Ошибка чтения файла: ${err.message}`));
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Fallback чтение через createObjectURL + fetch.
   * createObjectURL() захватывает ссылку на Blob синхронно.
   * fetch(blobUrl) затем читает данные через сетевой стек браузера,
   * что иногда обходит проблемы с SAF content:// URI.
   */
  async _readWithFetchFallback(file, fileName, fileType) {
    let blobUrl;
    try {
      blobUrl = URL.createObjectURL(file);
      const response = await fetch(blobUrl);
      const buffer = await response.arrayBuffer();
      return new File([buffer], fileName, { type: fileType });
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
  }

  /**
   * Обработка файла, который уже безопасно прочитан в память.
   * На этом этапе safeFile — in-memory File, независимый от DOM.
   * Любые DOM-изменения (скрытие dropzone и т.д.) безопасны.
   */
  async _processBookFile(safeFile) {
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
