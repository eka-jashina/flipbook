/**
 * CONFIGURATION
 *
 * Централизованное хранилище настроек.
 *
 * API:
 * - createConfig(adminConfig) — чистая фабричная функция, не обращается к localStorage.
 *   Используется для тестирования и создания конфигурации с явными данными.
 * - CONFIG — синглтон для production. Вычисляется один раз при загрузке модуля.
 *   Единственный side effect этого модуля: читает localStorage через loadAdminConfig().
 */

// Vite подставляет base URL для production
const BASE_URL = import.meta.env.BASE_URL || '/';

/**
 * Загрузка конфига админки из localStorage (если есть)
 * @returns {Object|null}
 */
function loadAdminConfig() {
  try {
    const raw = localStorage.getItem('flipbook-admin-config');
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённые данные — игнорируем */ }
  return null;
}

// ─── Чистые вспомогательные функции ─────────────────────────────────────────

// Резолвить путь к ресурсу (data: / http / относительный)
function resolveAssetPath(value) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// Получить активную книгу из конфига админки
function getActiveBook(config) {
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
function resolveCoverBg(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  return value.startsWith('http') ? value : `${BASE_URL}${value}`;
}

// Фон-подложка под книгу: поддержка режимов default/none/custom
function resolveCoverBgFromCover(cover, fallback) {
  if (cover.bgMode === 'none') return null;
  if (cover.bgMode === 'custom' && cover.bgCustomData) return cover.bgCustomData;
  // Для обратной совместимости (старый формат: текстовый путь)
  const legacyPath = fallback.includes('mobile') ? cover.bgMobile : cover.bg;
  return resolveCoverBg(legacyPath, fallback);
}

// Звук: из админки (data URL / http / путь) или дефолтный
function resolveSound(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// Амбиенты: из админки (с фильтрацией по visible) или дефолтные
function buildAmbientConfig(adminAmbients) {
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
function buildFontsConfig(adminReadingFonts) {
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

// ─── Фабричная функция ───────────────────────────────────────────────────────

/**
 * Создать конфигурацию приложения на основе данных из админки.
 *
 * Чистая функция: принимает adminConfig явно, без обращения к localStorage.
 * Используйте её в тестах и везде, где нужна воспроизводимость результата.
 *
 * @param {Object|null} adminConfig - Конфиг из AdminConfigStore или null для дефолтного
 * @returns {Readonly<Object>} Замороженный объект конфигурации
 */
export function createConfig(adminConfig = null) {
  const activeBook = getActiveBook(adminConfig);

  // Главы: из активной книги (с добавлением BASE_URL) или дефолтные
  // ch._idb — маркер: htmlContent хранится только в IndexedDB
  const CHAPTERS = activeBook?.chapters?.length
    ? activeBook.chapters.map(ch => ({
        id: ch.id,
        title: ch.title || '',
        file: resolveAssetPath(ch.file),
        htmlContent: ch.htmlContent || null,
        _idb: ch._idb || false,
        bg: resolveAssetPath(ch.bg),
        bgMobile: resolveAssetPath(ch.bgMobile),
      }))
    : [
        {
          id: "part_1",
          file: `${BASE_URL}content/part_1.html`,
          bg: `${BASE_URL}images/backgrounds/part_1.webp`,
          bgMobile: `${BASE_URL}images/backgrounds/part_1-mobile.webp`,
        },
        {
          id: "part_2",
          file: `${BASE_URL}content/part_2.html`,
          bg: `${BASE_URL}images/backgrounds/part_2.webp`,
          bgMobile: `${BASE_URL}images/backgrounds/part_2-mobile.webp`,
        },
        {
          id: "part_3",
          file: `${BASE_URL}content/part_3.html`,
          bg: `${BASE_URL}images/backgrounds/part_3.webp`,
          bgMobile: `${BASE_URL}images/backgrounds/part_3-mobile.webp`,
        },
      ];

  const adminDefaults = activeBook?.defaultSettings || {};
  const bookAppearance = activeBook?.appearance || {};
  const adminFontMin = adminConfig?.fontMin ?? adminConfig?.appearance?.fontMin;
  const adminFontMax = adminConfig?.fontMax ?? adminConfig?.appearance?.fontMax;
  const adminCover = activeBook?.cover || {};
  const adminSounds = activeBook?.sounds || {};
  const fontsResult = buildFontsConfig(adminConfig?.readingFonts);

  return Object.freeze({
    STORAGE_KEY: activeBook?.id ? `reader-settings:${activeBook.id}` : "reader-settings",
    COVER_BG: resolveCoverBgFromCover(adminCover, 'images/backgrounds/bg-cover.webp'),
    COVER_BG_MOBILE: resolveCoverBgFromCover(adminCover, 'images/backgrounds/bg-cover-mobile.webp'),

    CHAPTERS,

    FONTS: fontsResult.fonts,

    // Список шрифтов с метаданными (для генерации <select>)
    FONTS_LIST: fontsResult.fontsList,

    // Кастомные шрифты (нужна загрузка через FontFace)
    CUSTOM_FONTS: fontsResult.customFonts || [],

    // Декоративный шрифт (для заголовков, per-book)
    DECORATIVE_FONT: activeBook?.decorativeFont || null,

    SOUNDS: {
      pageFlip: resolveSound(adminSounds.pageFlip, 'sounds/page-flip.mp3'),
      bookOpen: resolveSound(adminSounds.bookOpen, 'sounds/cover-flip.mp3'),
      bookClose: resolveSound(adminSounds.bookClose, 'sounds/cover-flip.mp3'),
    },

    // Конфигурация ambient звуков (per-book)
    AMBIENT: buildAmbientConfig(activeBook?.ambients),

    DEFAULT_SETTINGS: {
      font: adminDefaults.font || "georgia",
      fontSize: adminDefaults.fontSize || 18,
      theme: adminDefaults.theme || "light",
      page: 0,
      soundEnabled: adminDefaults.soundEnabled ?? true,
      soundVolume: adminDefaults.soundVolume ?? 0.3,
      ambientType: adminDefaults.ambientType || 'none',
      ambientVolume: adminDefaults.ambientVolume ?? 0.5
    },

    // Настройки оформления: global fontMin/fontMax + per-book light/dark
    APPEARANCE: {
      coverTitle: adminCover.title || 'О хоббитах',
      coverAuthor: adminCover.author || 'Дж.Р.Р.Толкин',
      fontMin: adminFontMin ?? 14,
      fontMax: adminFontMax ?? 22,
      light: {
        coverBgStart: bookAppearance.light?.coverBgStart || '#3a2d1f',
        coverBgEnd: bookAppearance.light?.coverBgEnd || '#2a2016',
        coverText: bookAppearance.light?.coverText || '#f2e9d8',
        coverBgImage: bookAppearance.light?.coverBgImage || null,
        pageTexture: bookAppearance.light?.pageTexture || 'default',
        customTextureData: bookAppearance.light?.customTextureData || null,
        bgPage: bookAppearance.light?.bgPage || '#fdfcf8',
        bgApp: bookAppearance.light?.bgApp || '#e6e3dc',
      },
      dark: {
        coverBgStart: bookAppearance.dark?.coverBgStart || '#111111',
        coverBgEnd: bookAppearance.dark?.coverBgEnd || '#000000',
        coverText: bookAppearance.dark?.coverText || '#eaeaea',
        coverBgImage: bookAppearance.dark?.coverBgImage || null,
        pageTexture: bookAppearance.dark?.pageTexture || 'none',
        customTextureData: bookAppearance.dark?.customTextureData || null,
        bgPage: bookAppearance.dark?.bgPage || '#1e1e1e',
        bgApp: bookAppearance.dark?.bgApp || '#121212',
      },
    },

    // Видимость настроек для читателя (из админки)
    SETTINGS_VISIBILITY: {
      fontSize: adminConfig?.settingsVisibility?.fontSize ?? true,
      theme: adminConfig?.settingsVisibility?.theme ?? true,
      font: adminConfig?.settingsVisibility?.font ?? true,
      fullscreen: adminConfig?.settingsVisibility?.fullscreen ?? true,
      sound: adminConfig?.settingsVisibility?.sound ?? true,
      ambient: adminConfig?.settingsVisibility?.ambient ?? true,
    },

    VIRTUALIZATION: {
      cacheLimit: 50,
    },

    LAYOUT: {
      // Минимальное соотношение ширины страницы к книге
      // при котором считаем что layout стабилизировался
      MIN_PAGE_WIDTH_RATIO: 0.4,

      // Задержка ожидания стабилизации layout (ms)
      SETTLE_DELAY: 100,
    },

    TIMING_SAFETY_MARGIN: 100,

    // Настройки тайминга навигации
    TIMING: {
      // Минимальный интервал между перелистываниями для rate limiting (мс)
      FLIP_THROTTLE: 100,
    },

    // Настройки UI
    UI: {
      // Время отображения сообщения об ошибке перед автоскрытием (мс)
      ERROR_HIDE_TIMEOUT: 5000,
    },

    // Настройки сетевых операций
    NETWORK: {
      // Максимальное количество попыток загрузки
      MAX_RETRIES: 3,
      // Начальная задержка перед повторной попыткой (мс)
      // Увеличивается экспоненциально: 1000 → 2000 → 4000
      INITIAL_RETRY_DELAY: 1000,
      // Таймаут для fetch/загрузки ресурсов (мс)
      FETCH_TIMEOUT: 10000,
    },

    // Настройки аудио
    AUDIO: {
      // Задержка перед возобновлением ambient при возврате на вкладку (мс)
      VISIBILITY_RESUME_DELAY: 100,
    },
  });
}

// ─── Дозагрузка data URL из IndexedDB ────────────────────────────────────────

/**
 * Обогатить CONFIG данными из IndexedDB.
 *
 * При сохранении в localStorage крупные data URL (шрифты, амбиенты)
 * вырезаются и заменяются маркером `_idb: true` — аналогично htmlContent глав.
 * Эта функция дозагружает полные данные из IndexedDB и подставляет их в CONFIG.
 *
 * Вызывается один раз при старте ридера, до создания BookController.
 *
 * @param {Object} config - Объект CONFIG (top-level заморожен, вложенные — нет)
 */
export async function enrichConfigFromIDB(config) {
  const needsIdb =
    config.DECORATIVE_FONT?._idb ||
    config.CUSTOM_FONTS?.some(f => f._idb) ||
    Object.values(config.AMBIENT).some(a => a._idb);

  if (!needsIdb) return;

  let adminConfig;
  try {
    const { IdbStorage } = await import('./utils/IdbStorage.js');
    const idb = new IdbStorage('flipbook-admin', 'config');
    adminConfig = await idb.get('flipbook-admin-config');
  } catch {
    return;
  }
  if (!adminConfig) return;

  const activeBook = getActiveBook(adminConfig);

  // Декоративный шрифт
  if (config.DECORATIVE_FONT?._idb && activeBook?.decorativeFont?.dataUrl) {
    config.DECORATIVE_FONT.dataUrl = activeBook.decorativeFont.dataUrl;
  }

  // Амбиенты
  if (activeBook?.ambients) {
    const ambientMap = new Map(activeBook.ambients.map(a => [a.id, a]));
    for (const [type, cfg] of Object.entries(config.AMBIENT)) {
      if (cfg._idb) {
        const src = ambientMap.get(type);
        if (src?.file) {
          cfg.file = src.file;
        }
      }
    }
  }

  // Пользовательские шрифты для чтения
  if (config.CUSTOM_FONTS?.length && adminConfig.readingFonts) {
    const fontMap = new Map(adminConfig.readingFonts.map(f => [f.id, f]));
    for (const font of config.CUSTOM_FONTS) {
      if (font._idb) {
        const src = fontMap.get(font.id);
        if (src?.dataUrl) {
          font.dataUrl = src.dataUrl;
        }
      }
    }
  }
}

// ─── Синглтон для production ─────────────────────────────────────────────────

/**
 * Конфигурация приложения, вычисленная из данных в localStorage.
 *
 * Единственный side effect этого модуля: при первом импорте читает localStorage.
 * Для тестирования используйте createConfig(adminConfig) напрямую.
 */
export const CONFIG = createConfig(loadAdminConfig());

// ─── Константы (без side effects) ────────────────────────────────────────────

export const BookState = Object.freeze({
  CLOSED: "closed",
  OPENING: "opening",
  OPENED: "opened",
  FLIPPING: "flipping",
  CLOSING: "closing",
});

/**
 * Фазы анимации перелистывания страницы
 */
export const FlipPhase = Object.freeze({
  LIFT: "lift",
  ROTATE: "rotate",
  DROP: "drop",
  DRAG: "drag",
});

/**
 * Направления перелистывания
 */
export const Direction = Object.freeze({
  NEXT: "next",
  PREV: "prev",
});

/**
 * Строковые булевы значения для data-атрибутов
 */
export const BoolStr = Object.freeze({
  TRUE: "true",
  FALSE: "false",
});
