/**
 * AdminConfigStore
 *
 * Хранилище конфигурации книги для админки.
 * Читает/записывает в localStorage, предоставляет CRUD для глав и настроек.
 */

const STORAGE_KEY = 'flipbook-admin-config';

// Дефолтная конфигурация (совпадает с CONFIG из config.js)
const DEFAULT_CONFIG = {
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
    coverBgStart: '#3a2d1f',
    coverBgEnd: '#2a2016',
    coverText: '#f2e9d8',
    pageTexture: 'default',
    customTextureData: null,
    bgPage: '#fdfcf8',
    bgApp: '#e6e3dc',
    fontMin: 14,
    fontMax: 22,
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
    return {
      chapters: Array.isArray(saved.chapters) ? saved.chapters : structuredClone(DEFAULT_CONFIG.chapters),
      defaultSettings: {
        ...structuredClone(DEFAULT_CONFIG.defaultSettings),
        ...(saved.defaultSettings || {}),
      },
      appearance: {
        ...structuredClone(DEFAULT_CONFIG.appearance),
        ...(saved.appearance || {}),
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

  updateAppearance(appearance) {
    this._config.appearance = {
      ...this._config.appearance,
      ...appearance,
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
