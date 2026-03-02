/**
 * AdminConfigStore
 *
 * Хранилище конфигурации книги для админки.
 * Читает/записывает в IndexedDB (с миграцией из localStorage),
 * предоставляет CRUD для книг, глав и настроек.
 *
 * Поддерживает несколько книг. Одна книга — активная (отображается в ридере).
 *
 * Per-book: defaultSettings, appearance (light/dark), sounds, ambients, decorativeFont
 * Global:  readingFonts, settingsVisibility, fontMin, fontMax
 */

import { IdbStorage } from '../utils/IdbStorage.js';
import {
  LIGHT_DEFAULTS,
  DARK_DEFAULTS,
  DEFAULT_READING_FONTS,
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_BOOK,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA_VERSION,
} from './AdminConfigDefaults.js';

const STORAGE_KEY = 'flipbook-admin-config';
const IDB_NAME = 'flipbook-admin';
const IDB_STORE = 'config';

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Заменить data URL маркером _idb в объекте.
 * Мутирует объект, удаляя указанное поле и выставляя маркер.
 * @param {Object} obj - Объект для модификации
 * @param {string} field - Имя поля с data URL
 * @param {string} [markerField='_idb'] - Имя поля-маркера
 */
function stripDataUrl(obj, field, markerField = '_idb') {
  if (obj[field]?.startsWith?.('data:')) {
    obj[markerField] = true;
    delete obj[field];
  }
}

/**
 * Подготовить снимок книги для localStorage — убрать тяжёлые data URL.
 * Мутирует переданный объект.
 * @param {Object} book
 */
function stripBookDataUrls(book) {
  // Главы: htmlContent
  if (book.chapters) {
    for (const ch of book.chapters) {
      if (ch.htmlContent) {
        ch._idb = true;
        delete ch.htmlContent;
      }
    }
  }

  // Декоративный шрифт
  if (book.decorativeFont?.dataUrl) {
    book.decorativeFont = { name: book.decorativeFont.name, _idb: true };
  }

  // Амбиенты
  if (book.ambients) {
    for (const a of book.ambients) {
      stripDataUrl(a, 'file');
    }
  }

  // Оформление: coverBgImage, customTextureData
  if (book.appearance) {
    for (const theme of ['light', 'dark']) {
      const t = book.appearance[theme];
      if (!t) continue;
      stripDataUrl(t, 'coverBgImage', '_idbCoverBgImage');
      stripDataUrl(t, 'customTextureData', '_idbCustomTexture');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

export class AdminConfigStore {
  constructor() {
    this._config = structuredClone(DEFAULT_CONFIG);
    this._savePromise = null;
    this._idb = new IdbStorage(IDB_NAME, IDB_STORE);

    /** @type {number} Версия конфигурации для оптимистичной блокировки (CAS) */
    this._version = 0;

    /** @type {boolean} Идёт ли сейчас операция сохранения */
    this._saving = false;

    /** @type {boolean} Были ли изменения во время сохранения (нужно повторить) */
    this._dirtyDuringSave = false;

    /** @type {((error: Error) => void)|null} Колбэк ошибки */
    this.onError = null;

    /** @type {(() => void)|null} Колбэк успешного сохранения */
    this.onSave = null;
  }

  /**
   * Асинхронная фабрика — загружает конфиг из IndexedDB (с миграцией из localStorage)
   * @returns {Promise<AdminConfigStore>}
   */
  static async create() {
    const store = new AdminConfigStore();
    await store._init();
    return store;
  }

  /** Инициализация: загрузка из IndexedDB с миграцией из localStorage */
  async _init() {
    this._config = await this._load();
  }

  /** Загрузить конфиг из IndexedDB, затем localStorage (миграция), или дефолт */
  async _load() {
    // 1. Попробовать IndexedDB
    try {
      const data = await this._idb.get(STORAGE_KEY);
      if (data) {
        return this._mergeWithDefaults(data);
      }
    } catch {
      // IndexedDB недоступен — пробуем localStorage
    }

    // 2. Миграция из localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const config = this._mergeWithDefaults(parsed);

        // Мигрировать в IndexedDB (localStorage не удаляем — ридер читает оттуда)
        try {
          await this._idb.put(STORAGE_KEY, config);
        } catch {
          // Не удалось мигрировать — не критично, данные уже в памяти
        }

        return config;
      }
    } catch {
      // Повреждённые данные — используем дефолт
    }

    return structuredClone(DEFAULT_CONFIG);
  }

  /**
   * Валидировать структуру конфигурации по формальной схеме.
   * Возвращает массив ошибок. Пустой массив = валидно.
   * @param {Object} config
   * @returns {string[]}
   */
  static validateSchema(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
      return ['Конфигурация должна быть объектом'];
    }
    if (!Array.isArray(config.books)) {
      errors.push('books должен быть массивом');
    } else {
      for (let i = 0; i < config.books.length; i++) {
        const book = config.books[i];
        if (!book.id) errors.push(`books[${i}]: отсутствует id`);
        if (!book.cover || typeof book.cover !== 'object') errors.push(`books[${i}]: отсутствует cover`);
        if (!Array.isArray(book.chapters)) errors.push(`books[${i}]: chapters должен быть массивом`);
      }
    }
    if (typeof config.activeBookId !== 'string') {
      errors.push('activeBookId должен быть строкой');
    }
    if (typeof config.fontMin !== 'number' || !Number.isFinite(config.fontMin)) {
      errors.push('fontMin должен быть конечным числом');
    }
    if (typeof config.fontMax !== 'number' || !Number.isFinite(config.fontMax)) {
      errors.push('fontMax должен быть конечным числом');
    }
    if (!Array.isArray(config.readingFonts)) {
      errors.push('readingFonts должен быть массивом');
    }
    if (!config.settingsVisibility || typeof config.settingsVisibility !== 'object') {
      errors.push('settingsVisibility должен быть объектом');
    }
    return errors;
  }

  // ─── Миграции и нормализация ──────────────────────────────────────────────

  /** Гарантируем наличие всех полей после загрузки */
  _mergeWithDefaults(saved) {
    const savedVersion = saved._schemaVersion || 1;
    saved = this._migrateSchema(saved, savedVersion);

    const books = this._migrateBooks(saved);
    const topLevel = this._extractTopLevelFallback(saved);

    for (const book of books) {
      this._ensureBookSettings(book, topLevel);
    }

    const activeBookId = saved.activeBookId || (books.length > 0 ? books[0].id : 'default');

    // fontMin/fontMax: миграция из appearance (старый формат) на верхний уровень
    const fontMin = saved.fontMin ?? saved.appearance?.fontMin ?? DEFAULT_CONFIG.fontMin;
    const fontMax = saved.fontMax ?? saved.appearance?.fontMax ?? DEFAULT_CONFIG.fontMax;

    const result = {
      _schemaVersion: CONFIG_SCHEMA_VERSION,
      books,
      activeBookId,
      fontMin,
      fontMax,
      readingFonts: Array.isArray(saved.readingFonts)
        ? saved.readingFonts
        : structuredClone(DEFAULT_READING_FONTS),
      settingsVisibility: {
        ...structuredClone(DEFAULT_CONFIG.settingsVisibility),
        ...(saved.settingsVisibility || {}),
      },
    };

    const schemaErrors = AdminConfigStore.validateSchema(result);
    if (schemaErrors.length > 0) {
      console.warn('AdminConfigStore: расхождение со схемой конфигурации:', schemaErrors);
    }

    return result;
  }

  /** Миграция формата books из старой схемы */
  _migrateBooks(saved) {
    if (Array.isArray(saved.books) && saved.books.length > 0) {
      return saved.books;
    }
    if (saved.cover || saved.chapters) {
      return [{
        id: 'default',
        cover: { ...structuredClone(DEFAULT_BOOK.cover), ...(saved.cover || {}) },
        chapters: Array.isArray(saved.chapters) ? saved.chapters : structuredClone(DEFAULT_BOOK.chapters),
      }];
    }
    return structuredClone(DEFAULT_CONFIG.books);
  }

  /** Извлечь per-book настройки из верхнего уровня (старый формат) как fallback */
  _extractTopLevelFallback(saved) {
    return {
      defaultSettings: saved.defaultSettings || null,
      appearance: saved.appearance || null,
      sounds: saved.sounds || null,
      ambients: saved.ambients || null,
      decorativeFont: saved.decorativeFont !== undefined ? saved.decorativeFont : undefined,
    };
  }

  /**
   * Миграция данных между версиями схемы.
   * @param {Object} data
   * @param {number} fromVersion
   * @returns {Object}
   */
  _migrateSchema(data, fromVersion) {
    if (fromVersion < 2) {
      console.info(`AdminConfigStore: миграция схемы v${fromVersion} → v${CONFIG_SCHEMA_VERSION}`);
    }
    // Будущие миграции: if (fromVersion < 3) { ... }
    return data;
  }

  /** Обеспечить наличие per-book настроек в объекте книги */
  _ensureBookSettings(book, fallback) {
    if (!book.defaultSettings) {
      book.defaultSettings = {
        ...structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings),
        ...(fallback.defaultSettings || {}),
      };
    }

    if (!book.appearance) {
      const src = fallback.appearance || {};
      const hasPerTheme = src.light || src.dark;
      if (hasPerTheme) {
        book.appearance = {
          light: { ...structuredClone(LIGHT_DEFAULTS), ...(src.light || {}) },
          dark: { ...structuredClone(DARK_DEFAULTS), ...(src.dark || {}) },
        };
      } else {
        const rest = { ...src };
        delete rest.fontMin;
        delete rest.fontMax;
        book.appearance = {
          light: { ...structuredClone(LIGHT_DEFAULTS), ...rest },
          dark: structuredClone(DARK_DEFAULTS),
        };
      }
    } else {
      book.appearance.light = { ...structuredClone(LIGHT_DEFAULTS), ...(book.appearance.light || {}) };
      book.appearance.dark = { ...structuredClone(DARK_DEFAULTS), ...(book.appearance.dark || {}) };
    }

    if (!book.sounds) {
      book.sounds = { ...structuredClone(DEFAULT_BOOK_SETTINGS.sounds), ...(fallback.sounds || {}) };
    }

    if (!book.ambients) {
      book.ambients = Array.isArray(fallback.ambients)
        ? structuredClone(fallback.ambients)
        : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
    }

    if (book.decorativeFont === undefined) {
      book.decorativeFont = fallback.decorativeFont !== undefined
        ? (fallback.decorativeFont ? structuredClone(fallback.decorativeFont) : null)
        : null;
    }
  }

  // ─── Персистенция ─────────────────────────────────────────────────────────

  /**
   * Сохранить конфиг в IndexedDB и localStorage.
   * Использует оптимистичную блокировку: если во время сохранения
   * произошли новые изменения, автоматически повторяет сохранение.
   */
  _save() {
    this._version++;

    if (this._saving) {
      this._dirtyDuringSave = true;
      return;
    }

    this._performSave();
    if (this.onSave) this.onSave();
  }

  /** @private Непосредственное выполнение сохранения */
  _performSave() {
    this._saving = true;
    this._dirtyDuringSave = false;

    const snapshot = structuredClone(this._config);
    const savedVersion = this._version;

    this._saveToLocalStorage(snapshot);

    this._savePromise = this._idb.put(STORAGE_KEY, snapshot)
      .catch(err => {
        console.error('AdminConfigStore: ошибка сохранения в IndexedDB', err);
        if (this.onError) this.onError(err);
        throw err;
      })
      .finally(() => {
        this._saving = false;
        if (this._dirtyDuringSave || this._version !== savedVersion) {
          this._performSave();
        }
      });
  }

  /**
   * Синхронное сохранение облегчённой версии в localStorage.
   * Тяжёлые data URL заменяются маркерами _idb — ридер дозагрузит из IndexedDB.
   */
  _saveToLocalStorage(snapshot) {
    try {
      const lsSnapshot = structuredClone(snapshot);

      for (const book of lsSnapshot.books) {
        stripBookDataUrls(book);
      }

      // Шрифты для чтения: data URL
      if (lsSnapshot.readingFonts) {
        for (const f of lsSnapshot.readingFonts) {
          if (f.dataUrl) {
            f._idb = true;
            delete f.dataUrl;
          }
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(lsSnapshot));
    } catch (err) {
      console.warn('AdminConfigStore: localStorage сохранение не удалось', err.message);
    }
  }

  /** Дождаться завершения последнего сохранения */
  async waitForSave() {
    if (this._savePromise) {
      await this._savePromise;
    }
  }

  /** Получить весь конфиг */
  getConfig() {
    return structuredClone(this._config);
  }

  // ─── Книги ────────────────────────────────────────────────────────────────

  /** Получить список всех книг (краткая инфо) */
  getBooks() {
    return this._config.books.map(b => ({
      id: b.id,
      title: b.cover?.title || 'Без названия',
      author: b.cover?.author || '',
      chaptersCount: b.chapters?.length || 0,
    }));
  }

  /** ID активной книги */
  getActiveBookId() {
    return this._config.activeBookId;
  }

  /** Переключить активную книгу */
  setActiveBook(bookId) {
    const exists = this._config.books.some(b => b.id === bookId);
    if (!exists) return;
    this._config.activeBookId = bookId;
    this._save();
  }

  /** Получить активную книгу */
  _getActiveBook() {
    return this._config.books.find(b => b.id === this._config.activeBookId)
      || this._config.books[0];
  }

  /**
   * Выполнить операцию над активной книгой с автосохранением.
   * @param {(book: Object) => void} fn - Мутирующая операция
   * @returns {boolean} true если операция выполнена
   */
  _modifyActiveBook(fn) {
    const book = this._getActiveBook();
    if (!book) return false;
    fn(book);
    this._save();
    return true;
  }

  /** Добавить новую книгу */
  addBook(book) {
    this._config.books.push({
      id: book.id || `book_${Date.now()}`,
      cover: book.cover || { title: '', author: '', bg: '', bgMobile: '' },
      chapters: book.chapters || [],
      ...structuredClone(DEFAULT_BOOK_SETTINGS),
    });
    this._save();
  }

  /** Переместить книгу */
  moveBook(fromIndex, toIndex) {
    const books = this._config.books;
    if (fromIndex < 0 || fromIndex >= books.length) return;
    if (toIndex < 0 || toIndex >= books.length) return;

    const [moved] = books.splice(fromIndex, 1);
    books.splice(toIndex, 0, moved);
    this._save();
  }

  /** Удалить книгу по id */
  removeBook(bookId) {
    const idx = this._config.books.findIndex(b => b.id === bookId);
    if (idx === -1) return;
    this._config.books.splice(idx, 1);

    if (this._config.activeBookId === bookId) {
      this._config.activeBookId = this._config.books.length > 0 ? this._config.books[0].id : '';
    }
    this._save();
  }

  /** Переименовать книгу */
  updateBookMeta(bookId, meta) {
    const book = this._config.books.find(b => b.id === bookId);
    if (!book) return;
    if (meta.title !== undefined) book.cover.title = meta.title;
    if (meta.author !== undefined) book.cover.author = meta.author;
    this._save();
  }

  // ─── Обложка (активной книги) ─────────────────────────────────────────────

  getCover() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.cover) : structuredClone(DEFAULT_BOOK.cover);
  }

  updateCover(cover) {
    this._modifyActiveBook(book => {
      book.cover = { ...book.cover, ...cover };
    });
  }

  // ─── Главы (активной книги) ───────────────────────────────────────────────

  getChapters() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.chapters) : [];
  }

  addChapter(chapter) {
    this._modifyActiveBook(book => {
      book.chapters.push({ ...chapter });
    });
  }

  updateChapter(index, chapter) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.chapters.length) {
        book.chapters[index] = { ...chapter };
      }
    });
  }

  removeChapter(index) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.chapters.length) {
        book.chapters.splice(index, 1);
      }
    });
  }

  moveChapter(fromIndex, toIndex) {
    this._modifyActiveBook(book => {
      const chapters = book.chapters;
      if (fromIndex < 0 || fromIndex >= chapters.length) return;
      if (toIndex < 0 || toIndex >= chapters.length) return;

      const [moved] = chapters.splice(fromIndex, 1);
      chapters.splice(toIndex, 0, moved);
    });
  }

  // ─── Амбиенты (per-book, активной книги) ──────────────────────────────────

  getAmbients() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.ambients) : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
  }

  addAmbient(ambient) {
    this._modifyActiveBook(book => {
      book.ambients.push({ ...ambient });
    });
  }

  updateAmbient(index, data) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.ambients.length) {
        book.ambients[index] = { ...book.ambients[index], ...data };
      }
    });
  }

  removeAmbient(index) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.ambients.length) {
        book.ambients.splice(index, 1);
      }
    });
  }

  // ─── Звуки (per-book, активной книги) ─────────────────────────────────────

  getSounds() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.sounds) : structuredClone(DEFAULT_BOOK_SETTINGS.sounds);
  }

  updateSounds(sounds) {
    this._modifyActiveBook(book => {
      book.sounds = { ...book.sounds, ...sounds };
    });
  }

  // ─── Настройки по умолчанию (per-book, активной книги) ────────────────────

  getDefaultSettings() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.defaultSettings) : structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings);
  }

  updateDefaultSettings(settings) {
    this._modifyActiveBook(book => {
      book.defaultSettings = { ...book.defaultSettings, ...settings };
    });
  }

  // ─── Декоративный шрифт (per-book, активной книги) ────────────────────────

  getDecorativeFont() {
    const book = this._getActiveBook();
    return book?.decorativeFont ? { ...book.decorativeFont } : null;
  }

  setDecorativeFont(fontData) {
    this._modifyActiveBook(book => {
      book.decorativeFont = fontData ? { ...fontData } : null;
    });
  }

  // ─── Шрифты для чтения (global) ───────────────────────────────────────────

  getReadingFonts() {
    return structuredClone(this._config.readingFonts);
  }

  addReadingFont(font) {
    this._config.readingFonts.push({ ...font });
    this._save();
  }

  updateReadingFont(index, data) {
    if (index >= 0 && index < this._config.readingFonts.length) {
      this._config.readingFonts[index] = {
        ...this._config.readingFonts[index],
        ...data,
      };
      this._save();
    }
  }

  removeReadingFont(index) {
    if (index >= 0 && index < this._config.readingFonts.length) {
      this._config.readingFonts.splice(index, 1);
      this._save();
    }
  }

  // ─── Оформление ───────────────────────────────────────────────────────────

  /** Получить оформление: global fontMin/fontMax + per-book light/dark */
  getAppearance() {
    const book = this._getActiveBook();
    const appearance = book?.appearance || structuredClone(DEFAULT_BOOK_SETTINGS.appearance);
    return structuredClone({
      fontMin: this._config.fontMin,
      fontMax: this._config.fontMax,
      light: appearance.light,
      dark: appearance.dark,
    });
  }

  /** Обновить глобальные поля оформления (fontMin, fontMax) */
  updateAppearanceGlobal(data) {
    if (data.fontMin !== undefined) this._config.fontMin = data.fontMin;
    if (data.fontMax !== undefined) this._config.fontMax = data.fontMax;
    this._save();
  }

  /** Обновить per-theme поля оформления (активной книги) */
  updateAppearanceTheme(theme, data) {
    if (theme !== 'light' && theme !== 'dark') return;
    this._modifyActiveBook(book => {
      book.appearance[theme] = { ...book.appearance[theme], ...data };
    });
  }

  // ─── Видимость настроек (global) ──────────────────────────────────────────

  getSettingsVisibility() {
    return { ...this._config.settingsVisibility };
  }

  updateSettingsVisibility(data) {
    this._config.settingsVisibility = {
      ...this._config.settingsVisibility,
      ...data,
    };
    this._save();
  }

  // ─── Экспорт/Импорт ──────────────────────────────────────────────────────

  exportJSON() {
    return JSON.stringify(this._config, null, 2);
  }

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    this._config = this._mergeWithDefaults(parsed);
    this._save();
  }

  /** Сбросить всё к дефолтным */
  reset() {
    this._config = structuredClone(DEFAULT_CONFIG);
    this._save();
  }

  /** Удалить конфиг из IndexedDB и localStorage */
  clear() {
    this._idb.delete(STORAGE_KEY).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    this._config = structuredClone(DEFAULT_CONFIG);
  }
}
