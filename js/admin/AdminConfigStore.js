/**
 * AdminConfigStore
 *
 * Хранилище конфигурации книги для админки.
 * Читает/записывает в localStorage, предоставляет CRUD для книг, глав и настроек.
 *
 * Поддерживает несколько книг. Одна книга — активная (отображается в ридере).
 */

const STORAGE_KEY = 'flipbook-admin-config';

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
};

// Дефолтная конфигурация
const DEFAULT_CONFIG = {
  books: [structuredClone(DEFAULT_BOOK)],
  activeBookId: 'default',
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
    fontMin: 14,
    fontMax: 22,
    light: { ...LIGHT_DEFAULTS },
    dark: { ...DARK_DEFAULTS },
  },
  decorativeFont: null,
  readingFonts: structuredClone(DEFAULT_READING_FONTS),
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
    this._config = this._load();
  }

  /** Загрузить конфиг из localStorage или вернуть дефолтный */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this._mergeWithDefaults(parsed);
      }
    } catch {
      // Повреждённые данные — используем дефолт
    }
    return structuredClone(DEFAULT_CONFIG);
  }

  /** Гарантируем наличие всех полей после загрузки */
  _mergeWithDefaults(saved) {
    const appearance = saved.appearance || {};

    // Миграция: если нет light/dark — переносим плоскую структуру в light
    const hasPerTheme = appearance.light || appearance.dark;
    let light, dark;

    if (hasPerTheme) {
      light = { ...structuredClone(LIGHT_DEFAULTS), ...(appearance.light || {}) };
      dark = { ...structuredClone(DARK_DEFAULTS), ...(appearance.dark || {}) };
    } else {
      const rest = { ...appearance };
      delete rest.fontMin;
      delete rest.fontMax;
      light = { ...structuredClone(LIGHT_DEFAULTS), ...rest };
      dark = structuredClone(DARK_DEFAULTS);
    }

    // Миграция: старый формат (cover + chapters) → books[]
    let books;
    if (Array.isArray(saved.books) && saved.books.length > 0) {
      books = saved.books;
    } else if (saved.cover || saved.chapters) {
      // Старый формат — мигрируем в одну книгу
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

    const activeBookId = saved.activeBookId || (books.length > 0 ? books[0].id : 'default');

    return {
      books,
      activeBookId,
      sounds: {
        ...structuredClone(DEFAULT_CONFIG.sounds),
        ...(saved.sounds || {}),
      },
      ambients: Array.isArray(saved.ambients) ? saved.ambients : structuredClone(DEFAULT_CONFIG.ambients),
      defaultSettings: {
        ...structuredClone(DEFAULT_CONFIG.defaultSettings),
        ...(saved.defaultSettings || {}),
      },
      appearance: {
        fontMin: appearance.fontMin ?? DEFAULT_CONFIG.appearance.fontMin,
        fontMax: appearance.fontMax ?? DEFAULT_CONFIG.appearance.fontMax,
        light,
        dark,
      },
      decorativeFont: saved.decorativeFont || null,
      readingFonts: Array.isArray(saved.readingFonts)
        ? saved.readingFonts
        : structuredClone(DEFAULT_READING_FONTS),
      settingsVisibility: {
        ...structuredClone(DEFAULT_CONFIG.settingsVisibility),
        ...(saved.settingsVisibility || {}),
      },
    };
  }

  /** Сохранить конфиг в localStorage */
  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
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

  /** Добавить новую книгу */
  addBook(book) {
    this._config.books.push({
      id: book.id || `book_${Date.now()}`,
      cover: book.cover || { title: '', author: '', bg: '', bgMobile: '' },
      chapters: book.chapters || [],
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

  // --- Амбиенты ---

  getAmbients() {
    return structuredClone(this._config.ambients);
  }

  addAmbient(ambient) {
    this._config.ambients.push({ ...ambient });
    this._save();
  }

  updateAmbient(index, data) {
    if (index >= 0 && index < this._config.ambients.length) {
      this._config.ambients[index] = { ...this._config.ambients[index], ...data };
      this._save();
    }
  }

  removeAmbient(index) {
    if (index >= 0 && index < this._config.ambients.length) {
      this._config.ambients.splice(index, 1);
      this._save();
    }
  }

  // --- Звуки ---

  getSounds() {
    return structuredClone(this._config.sounds);
  }

  updateSounds(sounds) {
    this._config.sounds = {
      ...this._config.sounds,
      ...sounds,
    };
    this._save();
  }

  // --- Настройки ---

  getDefaultSettings() {
    return structuredClone(this._config.defaultSettings);
  }

  updateDefaultSettings(settings) {
    this._config.defaultSettings = {
      ...this._config.defaultSettings,
      ...settings,
    };
    this._save();
  }

  // --- Декоративный шрифт ---

  getDecorativeFont() {
    return this._config.decorativeFont
      ? { ...this._config.decorativeFont }
      : null;
  }

  setDecorativeFont(fontData) {
    this._config.decorativeFont = fontData ? { ...fontData } : null;
    this._save();
  }

  // --- Шрифты для чтения ---

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

  getAppearance() {
    return structuredClone(this._config.appearance);
  }

  /** Обновить глобальные поля оформления (fontMin, fontMax) */
  updateAppearanceGlobal(data) {
    if (data.fontMin !== undefined) this._config.appearance.fontMin = data.fontMin;
    if (data.fontMax !== undefined) this._config.appearance.fontMax = data.fontMax;
    this._save();
  }

  /** Обновить per-theme поля оформления */
  updateAppearanceTheme(theme, data) {
    if (theme !== 'light' && theme !== 'dark') return;
    this._config.appearance[theme] = {
      ...this._config.appearance[theme],
      ...data,
    };
    this._save();
  }

  // --- Видимость настроек ---

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

  /** Удалить конфиг из localStorage */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
    this._config = structuredClone(DEFAULT_CONFIG);
  }
}
