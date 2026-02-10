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

const STORAGE_KEY = 'flipbook-admin-config';
const IDB_NAME = 'flipbook-admin';
const IDB_STORE = 'config';
const IDB_VERSION = 1;

// Per-theme дефолты
const LIGHT_DEFAULTS = {
  coverBgStart: '#3a2d1f',
  coverBgEnd: '#2a2016',
  coverText: '#f2e9d8',
  coverBgImage: null,
  pageTexture: 'default',
  customTextureData: null,
  bgPage: '#fdfcf8',
  bgApp: '#e6e3dc',
};

const DARK_DEFAULTS = {
  coverBgStart: '#111111',
  coverBgEnd: '#000000',
  coverText: '#eaeaea',
  coverBgImage: null,
  pageTexture: 'none',
  customTextureData: null,
  bgPage: '#1e1e1e',
  bgApp: '#121212',
};

// Дефолтные шрифты для чтения
const DEFAULT_READING_FONTS = [
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", serif', builtin: true, enabled: true },
  { id: 'libre-baskerville', label: 'Libre Baskerville', family: '"Libre Baskerville", serif', builtin: true, enabled: true },
  { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true },
  { id: 'roboto', label: 'Roboto', family: 'Roboto, sans-serif', builtin: true, enabled: true },
  { id: 'open-sans', label: 'Open Sans', family: '"Open Sans", sans-serif', builtin: true, enabled: true },
];

// Дефолтные per-book настройки
const DEFAULT_BOOK_SETTINGS = {
  defaultSettings: {
    font: 'georgia',
    fontSize: 18,
    theme: 'light',
    soundEnabled: true,
    soundVolume: 0.3,
    ambientType: 'none',
    ambientVolume: 0.5,
  },
  appearance: {
    light: { ...LIGHT_DEFAULTS },
    dark: { ...DARK_DEFAULTS },
  },
  sounds: {
    pageFlip: 'sounds/page-flip.mp3',
    bookOpen: 'sounds/cover-flip.mp3',
    bookClose: 'sounds/cover-flip.mp3',
  },
  ambients: [
    { id: 'none', label: 'Без звука', shortLabel: 'Нет', icon: '✕', file: null, visible: true, builtin: true },
    { id: 'rain', label: 'Дождь', shortLabel: 'Дождь', icon: '🌧️', file: 'sounds/ambient/rain.mp3', visible: true, builtin: true },
    { id: 'fireplace', label: 'Камин', shortLabel: 'Камин', icon: '🔥', file: 'sounds/ambient/fireplace.mp3', visible: true, builtin: true },
    { id: 'cafe', label: 'Кафе', shortLabel: 'Кафе', icon: '☕', file: 'sounds/ambient/cafe.mp3', visible: true, builtin: true },
  ],
  decorativeFont: null,
};

// Дефолтная книга
const DEFAULT_BOOK = {
  id: 'default',
  cover: {
    title: 'О хоббитах',
    author: 'Дж.Р.Р.Толкин',
    bg: 'images/backgrounds/bg-cover.webp',
    bgMobile: 'images/backgrounds/bg-cover-mobile.webp',
  },
  chapters: [
    {
      id: 'part_1',
      file: 'content/part_1.html',
      bg: 'images/backgrounds/part_1.webp',
      bgMobile: 'images/backgrounds/part_1-mobile.webp',
    },
    {
      id: 'part_2',
      file: 'content/part_2.html',
      bg: 'images/backgrounds/part_2.webp',
      bgMobile: 'images/backgrounds/part_2-mobile.webp',
    },
    {
      id: 'part_3',
      file: 'content/part_3.html',
      bg: 'images/backgrounds/part_3.webp',
      bgMobile: 'images/backgrounds/part_3-mobile.webp',
    },
  ],
  ...structuredClone(DEFAULT_BOOK_SETTINGS),
};

// Дефолтная конфигурация
const DEFAULT_CONFIG = {
  books: [structuredClone(DEFAULT_BOOK)],
  activeBookId: 'default',
  // Global: диапазон шрифтов
  fontMin: 14,
  fontMax: 22,
  // Global: шрифты для чтения
  readingFonts: structuredClone(DEFAULT_READING_FONTS),
  // Global: видимость настроек
  settingsVisibility: {
    fontSize: true,
    theme: true,
    font: true,
    fullscreen: true,
    sound: true,
    ambient: true,
  },
};

export class AdminConfigStore {
  constructor() {
    this._config = structuredClone(DEFAULT_CONFIG);
    this._savePromise = null;
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
      const data = await this._idbGet(STORAGE_KEY);
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
          await this._idbPut(STORAGE_KEY, config);
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

  /** Гарантируем наличие всех полей после загрузки */
  _mergeWithDefaults(saved) {
    // --- Миграция книг из старого формата ---
    let books;
    if (Array.isArray(saved.books) && saved.books.length > 0) {
      books = saved.books;
    } else if (saved.cover || saved.chapters) {
      books = [{
        id: 'default',
        cover: {
          ...structuredClone(DEFAULT_BOOK.cover),
          ...(saved.cover || {}),
        },
        chapters: Array.isArray(saved.chapters) ? saved.chapters : structuredClone(DEFAULT_BOOK.chapters),
      }];
    } else {
      books = structuredClone(DEFAULT_CONFIG.books);
    }

    // --- Миграция per-book настроек из top-level (старый формат) ---
    // Если настройки были на верхнем уровне, копируем их в каждую книгу
    const topLevel = {
      defaultSettings: saved.defaultSettings || null,
      appearance: saved.appearance || null,
      sounds: saved.sounds || null,
      ambients: saved.ambients || null,
      decorativeFont: saved.decorativeFont !== undefined ? saved.decorativeFont : undefined,
    };

    for (const book of books) {
      this._ensureBookSettings(book, topLevel);
    }

    const activeBookId = saved.activeBookId || (books.length > 0 ? books[0].id : 'default');

    // --- Global: fontMin/fontMax ---
    // Миграция: раньше были в appearance, теперь на верхнем уровне
    let fontMin = saved.fontMin;
    let fontMax = saved.fontMax;
    if (fontMin === undefined && saved.appearance) {
      fontMin = saved.appearance.fontMin;
    }
    if (fontMax === undefined && saved.appearance) {
      fontMax = saved.appearance.fontMax;
    }

    return {
      books,
      activeBookId,
      fontMin: fontMin ?? DEFAULT_CONFIG.fontMin,
      fontMax: fontMax ?? DEFAULT_CONFIG.fontMax,
      readingFonts: Array.isArray(saved.readingFonts)
        ? saved.readingFonts
        : structuredClone(DEFAULT_READING_FONTS),
      settingsVisibility: {
        ...structuredClone(DEFAULT_CONFIG.settingsVisibility),
        ...(saved.settingsVisibility || {}),
      },
    };
  }

  /** Обеспечить наличие per-book настроек в объекте книги */
  _ensureBookSettings(book, fallback) {
    // defaultSettings
    if (!book.defaultSettings) {
      book.defaultSettings = {
        ...structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings),
        ...(fallback.defaultSettings || {}),
      };
    }

    // appearance (с миграцией light/dark)
    if (!book.appearance) {
      const src = fallback.appearance || {};
      const hasPerTheme = src.light || src.dark;
      let light, dark;
      if (hasPerTheme) {
        light = { ...structuredClone(LIGHT_DEFAULTS), ...(src.light || {}) };
        dark = { ...structuredClone(DARK_DEFAULTS), ...(src.dark || {}) };
      } else {
        const rest = { ...src };
        delete rest.fontMin;
        delete rest.fontMax;
        light = { ...structuredClone(LIGHT_DEFAULTS), ...rest };
        dark = structuredClone(DARK_DEFAULTS);
      }
      book.appearance = { light, dark };
    } else {
      // Убедиться что light/dark полные
      book.appearance.light = { ...structuredClone(LIGHT_DEFAULTS), ...(book.appearance.light || {}) };
      book.appearance.dark = { ...structuredClone(DARK_DEFAULTS), ...(book.appearance.dark || {}) };
    }

    // sounds
    if (!book.sounds) {
      book.sounds = {
        ...structuredClone(DEFAULT_BOOK_SETTINGS.sounds),
        ...(fallback.sounds || {}),
      };
    }

    // ambients
    if (!book.ambients) {
      book.ambients = Array.isArray(fallback.ambients)
        ? structuredClone(fallback.ambients)
        : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
    }

    // decorativeFont
    if (book.decorativeFont === undefined) {
      book.decorativeFont = fallback.decorativeFont !== undefined
        ? (fallback.decorativeFont ? structuredClone(fallback.decorativeFont) : null)
        : null;
    }
  }

  /** Сохранить конфиг в IndexedDB и localStorage (для ридера) */
  _save() {
    const snapshot = structuredClone(this._config);

    // Синхронизируем в localStorage — ридер (config.js) читает оттуда.
    // Сохраняем облегчённую версию: без htmlContent (он может быть очень большим
    // из-за base64-изображений из EPUB/FB2, и не помещается в лимит localStorage,
    // особенно на мобильных устройствах — обычно 5 МБ).
    // Полная версия хранится в IndexedDB, ридер дозагрузит htmlContent оттуда.
    try {
      const lsSnapshot = structuredClone(snapshot);
      for (const book of lsSnapshot.books) {
        if (!book.chapters) continue;
        for (const ch of book.chapters) {
          if (ch.htmlContent) {
            ch._idb = true;    // маркер: контент в IndexedDB
            delete ch.htmlContent;
          }
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lsSnapshot));
    } catch {
      // localStorage переполнен даже без htmlContent — не критично, IndexedDB основной
    }

    this._savePromise = this._idbPut(STORAGE_KEY, snapshot)
      .catch(err => {
        console.error('AdminConfigStore: ошибка сохранения в IndexedDB', err);
        throw err;
      });
  }

  /** Дождаться завершения последнего сохранения (для операций, где важен результат) */
  async waitForSave() {
    if (this._savePromise) {
      await this._savePromise;
    }
  }

  // --- IndexedDB ---

  /** Открыть соединение с IndexedDB */
  _idbOpen() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Прочитать значение из IndexedDB */
  async _idbGet(key) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  /** Записать значение в IndexedDB */
  async _idbPut(key, value) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  /** Удалить значение из IndexedDB */
  async _idbDelete(key) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  /** Получить весь конфиг */
  getConfig() {
    return structuredClone(this._config);
  }

  // --- Книги ---

  /** Получить список всех книг (краткая инфо: id, title, author, chaptersCount) */
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

  /** Добавить новую книгу (per-book настройки берутся из дефолтов) */
  addBook(book) {
    this._config.books.push({
      id: book.id || `book_${Date.now()}`,
      cover: book.cover || { title: '', author: '', bg: '', bgMobile: '' },
      chapters: book.chapters || [],
      // Per-book: всегда дефолтные значения
      ...structuredClone(DEFAULT_BOOK_SETTINGS),
    });
    this._save();
  }

  /** Удалить книгу по id */
  removeBook(bookId) {
    const idx = this._config.books.findIndex(b => b.id === bookId);
    if (idx === -1) return;
    this._config.books.splice(idx, 1);

    // Если удалили активную — переключаемся на первую
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

  // --- Обложка (активной книги) ---

  getCover() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.cover) : structuredClone(DEFAULT_BOOK.cover);
  }

  updateCover(cover) {
    const book = this._getActiveBook();
    if (!book) return;
    book.cover = { ...book.cover, ...cover };
    this._save();
  }

  // --- Главы (активной книги) ---

  getChapters() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.chapters) : [];
  }

  addChapter(chapter) {
    const book = this._getActiveBook();
    if (!book) return;
    book.chapters.push({ ...chapter });
    this._save();
  }

  updateChapter(index, chapter) {
    const book = this._getActiveBook();
    if (!book) return;
    if (index >= 0 && index < book.chapters.length) {
      book.chapters[index] = { ...chapter };
      this._save();
    }
  }

  removeChapter(index) {
    const book = this._getActiveBook();
    if (!book) return;
    if (index >= 0 && index < book.chapters.length) {
      book.chapters.splice(index, 1);
      this._save();
    }
  }

  moveChapter(fromIndex, toIndex) {
    const book = this._getActiveBook();
    if (!book) return;
    const chapters = book.chapters;
    if (fromIndex < 0 || fromIndex >= chapters.length) return;
    if (toIndex < 0 || toIndex >= chapters.length) return;

    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    this._save();
  }

  // --- Амбиенты (per-book, активной книги) ---

  getAmbients() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.ambients) : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
  }

  addAmbient(ambient) {
    const book = this._getActiveBook();
    if (!book) return;
    book.ambients.push({ ...ambient });
    this._save();
  }

  updateAmbient(index, data) {
    const book = this._getActiveBook();
    if (!book) return;
    if (index >= 0 && index < book.ambients.length) {
      book.ambients[index] = { ...book.ambients[index], ...data };
      this._save();
    }
  }

  removeAmbient(index) {
    const book = this._getActiveBook();
    if (!book) return;
    if (index >= 0 && index < book.ambients.length) {
      book.ambients.splice(index, 1);
      this._save();
    }
  }

  // --- Звуки (per-book, активной книги) ---

  getSounds() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.sounds) : structuredClone(DEFAULT_BOOK_SETTINGS.sounds);
  }

  updateSounds(sounds) {
    const book = this._getActiveBook();
    if (!book) return;
    book.sounds = { ...book.sounds, ...sounds };
    this._save();
  }

  // --- Настройки по умолчанию (per-book, активной книги) ---

  getDefaultSettings() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.defaultSettings) : structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings);
  }

  updateDefaultSettings(settings) {
    const book = this._getActiveBook();
    if (!book) return;
    book.defaultSettings = { ...book.defaultSettings, ...settings };
    this._save();
  }

  // --- Декоративный шрифт (per-book, активной книги) ---

  getDecorativeFont() {
    const book = this._getActiveBook();
    return book?.decorativeFont ? { ...book.decorativeFont } : null;
  }

  setDecorativeFont(fontData) {
    const book = this._getActiveBook();
    if (!book) return;
    book.decorativeFont = fontData ? { ...fontData } : null;
    this._save();
  }

  // --- Шрифты для чтения (global) ---

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

  // --- Оформление ---

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
    const book = this._getActiveBook();
    if (!book) return;
    book.appearance[theme] = {
      ...book.appearance[theme],
      ...data,
    };
    this._save();
  }

  // --- Видимость настроек (global) ---

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

  // --- Экспорт/Импорт ---

  exportJSON() {
    return JSON.stringify(this._config, null, 2);
  }

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString); // может бросить ошибку
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
    this._idbDelete(STORAGE_KEY).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    this._config = structuredClone(DEFAULT_CONFIG);
  }
}
