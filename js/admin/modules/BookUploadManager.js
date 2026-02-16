/**
 * Менеджер загрузки книг
 *
 * Чтение файла выполняется через FileReader.readAsDataURL() —
 * этот метод наиболее совместим с Android content:// URI (файлы из «Загрузок»).
 * Data URL затем конвертируется в ArrayBuffer для передачи в парсер.
 */

import { BookParser } from '../BookParser.js';

const NATIVE_BOOK_PLUGIN_NAME = 'BookImport';

const SUPPORTED_BOOK_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

/**
 * MIME-типы, которые могут соответствовать поддерживаемым форматам книг.
 * application/octet-stream включён, потому что Android часто присваивает его
 * файлам .epub, .fb2 и другим нестандартным форматам.
 */
const SUPPORTED_BOOK_MIME_TYPES = [
  'application/epub+zip',
  'application/x-fictionbook+xml',
  'application/xml',
  'text/xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/octet-stream',
];

function getExtension(fileName = '') {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex < 0 ? '' : fileName.slice(dotIndex).toLowerCase();
}

function isAndroidBrowser() {
  return /android/i.test(navigator.userAgent);
}

function hasSupportedHint(fileName = '', mimeType = '') {
  const ext = getExtension(fileName);
  if (ext) {
    return SUPPORTED_BOOK_EXTENSIONS.includes(ext);
  }

  // Без расширения — проверяем MIME-тип по списку допустимых
  if (mimeType) {
    return SUPPORTED_BOOK_MIME_TYPES.includes(mimeType.toLowerCase());
  }

  return false;
}

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
    this.bookNativeImport = document.getElementById('bookNativeImport');
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
    // На Android accept с узкими MIME-типами ограничивает видимые хранилища
    // в файловом пикере (часто только «Документы»). Сбрасываем на */*,
    // чтобы пользователь мог выбирать файлы из любого места.
    // Валидация формата выполняется в _readAndProcess() по расширению/MIME-типу.
    if (isAndroidBrowser()) {
      this.bookFileInput.accept = '*/*';
    }

    this.bookFileInput.addEventListener('change', (e) => this._handleFileChange(e));

    if (this.bookNativeImport) {
      this.bookNativeImport.hidden = !this._isNativeCapacitorPlatform();
      this.bookNativeImport.addEventListener('click', () => this._pickNativeBook());
    }

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

  _isNativeCapacitorPlatform() {
    const capacitor = window?.Capacitor;
    return Boolean(capacitor?.isNativePlatform?.());
  }

  _getNativeBookImportPlugin() {
    const capacitor = window?.Capacitor;
    return capacitor?.Plugins?.[NATIVE_BOOK_PLUGIN_NAME] || null;
  }

  async _pickNativeBook() {
    const plugin = this._getNativeBookImportPlugin();
    if (!plugin?.pickBook) {
      this._module._showToast('Нативный импорт недоступен: плагин BookImport не найден');
      return;
    }

    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Выбор файла...';

    try {
      const result = await plugin.pickBook();
      if (!result || result.cancelled) {
        this.bookUploadProgress.hidden = true;
        return;
      }

      const base64 = String(result.base64 || '');
      if (!base64) {
        throw new Error('Пустой ответ плагина: отсутствует base64');
      }

      const fileName = result.fileName || 'book';
      const mimeType = result.mimeType || '';
      const buffer = this._base64ToArrayBuffer(base64);
      await this._processBuffer(buffer, fileName, mimeType);
    } catch (err) {
      const message = err?.message || 'неизвестная ошибка';
      this._module._showToast(`Ошибка нативного импорта: ${message}`);
      this._resetBookUpload();
    }
  }

  _base64ToArrayBuffer(base64Value) {
    const normalized = String(base64Value || '').replace(/\s/g, '');
    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Прочитать файл и обработать.
   * Использует readAsDataURL (совместим с Android content:// URI)
   * с конверсией в ArrayBuffer для парсеров.
   */
  async _readAndProcess(file) {
    const fileName = file?.name || '';
    const mimeType = file?.type || '';

    if (!hasSupportedHint(fileName, mimeType)) {
      this._module._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      this.bookFileInput.value = '';
      return;
    }

    let buffer;
    try {
      buffer = await this._readFileAsArrayBuffer(file);
    } catch (err) {
      const message = err?.message || 'неизвестная ошибка';
      const isAndroidDownloadsError = /a file or directory could not be found/i.test(message);
      if (isAndroidDownloadsError) {
        this._module._showToast('Не удалось получить доступ к файлу из «Загрузок». Попробуйте выбрать через «Файлы»/Google Files, переместить файл в другую папку или переименовать его.');
      } else {
        this._module._showToast(`Ошибка чтения файла: ${message}`);
      }
      this.bookFileInput.value = '';
      return;
    }

    const safeFileName = fileName || 'book';
    this._processBuffer(buffer, safeFileName, mimeType);
  }

  /**
   * Прочитать файл как ArrayBuffer.
   *
   * На Android чтение файлов из «Загрузок» через DocumentProvider может быть нестабильным:
   * один и тот же content:// URI иногда ломается в FileReader с NotFoundError
   * ("A file or directory could not be found"), но читается через другой API.
   *
   * Стратегия:
   * 1) readAsDataURL → base64 → ArrayBuffer
   * 2) Response(file).arrayBuffer()
   * 3) fetch(blob:...) через URL.createObjectURL(file)
   * 4) file.arrayBuffer()
   * 5) readAsArrayBuffer
   *
   * @param {File|Blob} file
   * @returns {Promise<ArrayBuffer>}
   */
  async _readFileAsArrayBuffer(file) {
    const errors = [];

    // 1) FileReader.readAsDataURL → конвертация в ArrayBuffer
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      const base64 = String(dataUrl || '').split(',')[1];
      if (base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    } catch (err) {
      errors.push(err);
    }

    // 2) Response(file).arrayBuffer() — альтернативный путь через поток Blob
    //    В ряде Android WebView/Chrome случаев проходит, когда FileReader падает.
    if (typeof Response === 'function') {
      try {
        return await new Response(file).arrayBuffer();
      } catch (err) {
        errors.push(err);
      }
    }

    // 3) fetch(blob:...) часто успешен там, где FileReader падает на Android
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof fetch === 'function') {
      let objectUrl = '';
      try {
        objectUrl = URL.createObjectURL(file);
        const response = await fetch(objectUrl);
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (err) {
        errors.push(err);
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }
    }

    // 4) Blob.arrayBuffer()
    if (typeof file?.arrayBuffer === 'function') {
      try {
        return await file.arrayBuffer();
      } catch (err) {
        errors.push(err);
      }
    }

    // 5) FileReader.readAsArrayBuffer как последний вариант
    try {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
        reader.readAsArrayBuffer(file);
      });
    } catch (err) {
      errors.push(err);
    }

    const lastError = errors[errors.length - 1];
    throw (lastError || new Error('Не удалось прочитать файл'));
  }

  /**
   * Обработка буфера — парсинг и показ результата.
   */
  async _processBuffer(buffer, fileName, mimeType = '') {
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(buffer, fileName, mimeType);
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
