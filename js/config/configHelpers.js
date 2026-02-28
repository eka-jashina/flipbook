/**
 * CONFIG HELPERS
 * Чистые вспомогательные функции для построения конфигурации.
 *
 * Используются в createConfig() и createConfigFromAPI() для
 * резолвинга путей, построения шрифтов, амбиентов и т.д.
 */

// Vite подставляет base URL для production
export const BASE_URL = import.meta.env.BASE_URL || '/';

// ─── Загрузка и хранение ──────────────────────────────────────────────────────

/**
 * Загрузка конфига админки из localStorage (если есть)
 * @returns {Object|null}
 */
export function loadAdminConfig() {
  try {
    const raw = localStorage.getItem('flipbook-admin-config');
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённые данные — игнорируем */ }
  return null;
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

// ─── Построение конфиг-секций ─────────────────────────────────────────────────

// Амбиенты: из админки (с фильтрацией по visible) или дефолтные
export function buildAmbientConfig(adminAmbients) {
  const defaultAmbients = {
    none: { label: "Без звука", shortLabel: "Нет", icon: "✕", file: null },
    rain: { label: "Дождь", shortLabel: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
    fireplace: { label: "Камин", shortLabel: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
    cafe: { label: "Кафе", shortLabel: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
  };

  if (!Array.isArray(adminAmbients) || adminAmbients.length === 0) {
    return defaultAmbients;
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

// Шрифты для чтения: из админки (только enabled) или дефолтные
export function buildFontsConfig(adminReadingFonts) {
  const defaultFonts = {
    georgia: "Georgia, serif",
    merriweather: '"Merriweather", serif',
    "libre-baskerville": '"Libre Baskerville", serif',
    inter: "Inter, sans-serif",
    roboto: "Roboto, sans-serif",
    "open-sans": '"Open Sans", sans-serif',
  };

  if (!Array.isArray(adminReadingFonts) || adminReadingFonts.length === 0) {
    return { fonts: defaultFonts, fontsList: null };
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
