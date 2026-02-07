/**
 * AdminConfigStore
 *
 * Хранилище конфигурации книги для админки.
 * Читает/записывает в localStorage, предоставляет CRUD для глав и настроек.
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

// Дефолтная конфигурация (совпадает с CONFIG из config.js)
const DEFAULT_CONFIG = {
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
      // Старый формат — мигрируем в light
      const rest = { ...appearance };
      delete rest.fontMin;
      delete rest.fontMax;
      light = { ...structuredClone(LIGHT_DEFAULTS), ...rest };
      dark = structuredClone(DARK_DEFAULTS);
    }

    return {
      cover: {
        ...structuredClone(DEFAULT_CONFIG.cover),
        ...(saved.cover || {}),
      },
      chapters: Array.isArray(saved.chapters) ? saved.chapters : structuredClone(DEFAULT_CONFIG.chapters),
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

  // --- Обложка ---

  getCover() {
    return structuredClone(this._config.cover);
  }

  updateCover(cover) {
    this._config.cover = {
      ...this._config.cover,
      ...cover,
    };
    this._save();
  }

  // --- Главы ---

  getChapters() {
    return structuredClone(this._config.chapters);
  }

  addChapter(chapter) {
    this._config.chapters.push({ ...chapter });
    this._save();
  }

  updateChapter(index, chapter) {
    if (index >= 0 && index < this._config.chapters.length) {
      this._config.chapters[index] = { ...chapter };
      this._save();
    }
  }

  removeChapter(index) {
    if (index >= 0 && index < this._config.chapters.length) {
      this._config.chapters.splice(index, 1);
      this._save();
    }
  }

  moveChapter(fromIndex, toIndex) {
    const chapters = this._config.chapters;
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
