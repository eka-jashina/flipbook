/**
 * CONFIG HELPERS
 * Чистые вспомогательные функции для построения конфигурации.
 *
 * Используются в createConfig() и createConfigFromAPI() для
 * резолвинга путей, построения шрифтов, амбиентов и т.д.
 */

import { StorageManager } from '../utils/StorageManager.js';

// Vite подставляет base URL для production
export const BASE_URL = import.meta.env.BASE_URL || '/';

/** StorageManager для конфига админки — используется в нескольких модулях */
export const adminConfigStorage = new StorageManager('flipbook-admin-config');

// ─── Загрузка и хранение ──────────────────────────────────────────────────────

/**
 * Загрузка конфига админки из localStorage (если есть)
 * @returns {Object|null}
 */
export function loadAdminConfig() {
  const data = adminConfigStorage.load();
  return Object.keys(data).length > 0 ? data : null;
}

// ─── Иммутабельность ──────────────────────────────────────────────────────────

/**
 * Рекурсивная заморозка объекта (глубокий Object.freeze).
 * Предотвращает случайные мутации вложенных объектов конфигурации.
 * @param {Object} obj
 * @returns {Readonly<Object>}
 */
export function deepFreeze(obj) {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// ─── Резолвинг путей ──────────────────────────────────────────────────────────

// Резолвить путь к ресурсу (data: / http / относительный)
export function resolveAssetPath(value) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// Получить активную книгу из конфига админки
export function getActiveBook(config) {
  if (!config) return null;

  // Новый формат: books[] + activeBookId
  if (Array.isArray(config.books) && config.books.length > 0) {
    const active = config.books.find(b => b.id === config.activeBookId);
    return active || config.books[0];
  }

  // Старый формат: cover + chapters на верхнем уровне
  if (config.chapters?.length) {
    return { cover: config.cover || {}, chapters: config.chapters };
  }

  return null;
}

// Фон обложки: из админки (с добавлением BASE_URL) или дефолтный
export function resolveCoverBg(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  return value.startsWith('http') ? value : `${BASE_URL}${value}`;
}

// Фон-подложка под книгу: поддержка режимов default/none/custom
export function resolveCoverBgFromCover(cover, fallback) {
  if (cover.bgMode === 'none') return null;
  if (cover.bgMode === 'custom' && cover.bgCustomData) return cover.bgCustomData;
  // Для обратной совместимости (старый формат: текстовый путь)
  const legacyPath = fallback.includes('mobile') ? cover.bgMobile : cover.bg;
  return resolveCoverBg(legacyPath, fallback);
}

// Звук: из админки (data URL / http / путь) или дефолтный
export function resolveSound(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// ─── Дефолтные значения секций ────────────────────────────────────────────────

/** Дефолтные оформления тем — используются в createConfig и createConfigFromAPI */
const LIGHT_THEME_DEFAULTS = {
  coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8',
  coverBgImage: null, pageTexture: 'default', customTextureData: null,
  bgPage: '#fdfcf8', bgApp: '#e6e3dc',
};

const DARK_THEME_DEFAULTS = {
  coverBgStart: '#111111', coverBgEnd: '#000000', coverText: '#eaeaea',
  coverBgImage: null, pageTexture: 'none', customTextureData: null,
  bgPage: '#1e1e1e', bgApp: '#121212',
};

/** Дефолтная карта шрифтов */
const DEFAULT_FONTS = {
  georgia: "Georgia, serif",
  merriweather: '"Merriweather", serif',
  "libre-baskerville": '"Libre Baskerville", serif',
  inter: "Inter, sans-serif",
  roboto: "Roboto, sans-serif",
  "open-sans": '"Open Sans", sans-serif',
};

/** Дефолтные амбиенты */
function getDefaultAmbients() {
  return {
    none: { label: "Без звука", shortLabel: "Нет", icon: "✕", file: null },
    rain: { label: "Дождь", shortLabel: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
    fireplace: { label: "Камин", shortLabel: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
    cafe: { label: "Кафе", shortLabel: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
  };
}

// ─── Построение конфиг-секций ─────────────────────────────────────────────────

/**
 * Построить DEFAULT_SETTINGS из источника (adminDefaults / API defaults).
 * @param {Object} src - Источник настроек ({ font, fontSize, theme, ... })
 * @returns {Object}
 */
export function buildDefaultSettings(src = {}) {
  return {
    font: src.font || "georgia",
    fontSize: src.fontSize || 18,
    theme: src.theme || "light",
    page: 0,
    soundEnabled: src.soundEnabled ?? true,
    soundVolume: src.soundVolume ?? 0.3,
    ambientType: src.ambientType || 'none',
    ambientVolume: src.ambientVolume ?? 0.5,
  };
}

/**
 * Построить тему оформления (light/dark) с дефолтами.
 * @param {'light'|'dark'} theme - Тема
 * @param {Object} src - Исходные данные темы
 * @param {Object} [fieldMap] - Маппинг полей API → CONFIG (для coverBgImageUrl → coverBgImage и т.д.)
 * @returns {Object}
 */
export function buildAppearanceTheme(theme, src = {}, fieldMap = null) {
  const defaults = theme === 'dark' ? DARK_THEME_DEFAULTS : LIGHT_THEME_DEFAULTS;
  const result = {};

  for (const key of Object.keys(defaults)) {
    // Если передан маппинг полей (API формат) — сначала ищем по маппингу
    const srcKey = fieldMap?.[key] || key;
    result[key] = src[srcKey] ?? defaults[key];
  }

  return result;
}

/**
 * Построить SETTINGS_VISIBILITY из источника.
 * @param {Object} src - Источник видимости настроек
 * @returns {Object}
 */
export function buildSettingsVisibility(src = {}) {
  return {
    fontSize: src.fontSize ?? true,
    theme: src.theme ?? true,
    font: src.font ?? true,
    fullscreen: src.fullscreen ?? true,
    sound: src.sound ?? true,
    ambient: src.ambient ?? true,
  };
}

/**
 * Построить SOUNDS из источника.
 * @param {Object} src - Источник звуков ({ pageFlip, bookOpen, bookClose })
 * @returns {Object}
 */
export function buildSoundsConfig(src = {}) {
  return {
    pageFlip: resolveSound(src.pageFlip, 'sounds/page-flip.mp3'),
    bookOpen: resolveSound(src.bookOpen, 'sounds/cover-flip.mp3'),
    bookClose: resolveSound(src.bookClose, 'sounds/cover-flip.mp3'),
  };
}

// Амбиенты: из админки (с фильтрацией по visible) или дефолтные
export function buildAmbientConfig(adminAmbients) {
  if (!Array.isArray(adminAmbients) || adminAmbients.length === 0) {
    return getDefaultAmbients();
  }

  const result = {};
  for (const a of adminAmbients) {
    if (!a.visible) continue;
    const file = a.file
      ? (a.file.startsWith('data:') || a.file.startsWith('http') ? a.file : `${BASE_URL}${a.file}`)
      : null;
    result[a.id] = {
      label: a.label,
      shortLabel: a.shortLabel || a.label,
      icon: a.icon,
      file,
      _idb: a._idb || false,
    };
  }
  return result;
}

/**
 * Амбиенты из API формата → CONFIG формат.
 * @param {Array} apiAmbients - Амбиенты из API
 * @returns {Object}
 */
export function buildAmbientConfigFromAPI(apiAmbients) {
  if (!apiAmbients?.length) return getDefaultAmbients();

  const result = {};
  for (const a of apiAmbients) {
    if (!a.visible) continue;
    result[a.ambientKey || a.id] = {
      label: a.label,
      shortLabel: a.shortLabel || a.label,
      icon: a.icon,
      file: a.fileUrl ? resolveAssetPath(a.fileUrl) : null,
    };
  }
  return Object.keys(result).length > 0 ? result : getDefaultAmbients();
}

// Шрифты для чтения: из админки (только enabled) или дефолтные
export function buildFontsConfig(adminReadingFonts) {
  if (!Array.isArray(adminReadingFonts) || adminReadingFonts.length === 0) {
    return { fonts: DEFAULT_FONTS, fontsList: null };
  }

  const fonts = {};
  const customFonts = [];
  for (const f of adminReadingFonts) {
    if (!f.enabled) continue;
    fonts[f.id] = f.family;
    if (!f.builtin && (f.dataUrl || f._idb)) {
      customFonts.push({ id: f.id, label: f.label, family: f.family, dataUrl: f.dataUrl || null, _idb: f._idb || false });
    }
  }
  return { fonts, fontsList: adminReadingFonts.filter(f => f.enabled), customFonts };
}

/**
 * Шрифты из API формата → CONFIG формат.
 * @param {Array} apiFonts - Шрифты из API
 * @returns {{ fonts: Object, fontsList: Array|null, customFonts: Array }}
 */
export function buildFontsConfigFromAPI(apiFonts) {
  if (!apiFonts?.length) return { fonts: DEFAULT_FONTS, fontsList: null, customFonts: [] };

  const fonts = {};
  const fontsList = [];
  const customFonts = [];
  for (const f of apiFonts) {
    if (!f.enabled) continue;
    const key = f.fontKey || f.id;
    fonts[key] = f.family;
    fontsList.push({ id: key, label: f.label, family: f.family, builtin: f.builtin, enabled: f.enabled });
    if (!f.builtin && f.fileUrl) {
      customFonts.push({ id: key, label: f.label, family: f.family, dataUrl: f.fileUrl });
    }
  }
  return {
    fonts: Object.keys(fonts).length > 0 ? fonts : DEFAULT_FONTS,
    fontsList: fontsList.length > 0 ? fontsList : null,
    customFonts,
  };
}

// ─── Общие настройки (timing, layout, UI и т.д.) ──────────────────────────────

export function buildCommonConfig() {
  return {
    VIRTUALIZATION: { cacheLimit: 50 },
    LAYOUT: { MIN_PAGE_WIDTH_RATIO: 0.4, SETTLE_DELAY: 100 },
    TIMING_SAFETY_MARGIN: 100,
    TIMING: { FLIP_THROTTLE: 100 },
    UI: { ERROR_HIDE_TIMEOUT: 5000 },
    NETWORK: { MAX_RETRIES: 3, INITIAL_RETRY_DELAY: 1000, FETCH_TIMEOUT: 10000 },
    AUDIO: { VISIBILITY_RESUME_DELAY: 100 },
  };
}
