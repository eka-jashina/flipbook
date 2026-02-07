/**
 * CONFIGURATION
 *
 * Централизованное хранилище настроек.
 * Если в localStorage есть конфиг от админки — используем его для глав и настроек.
 */

// Vite подставляет base URL для production
const BASE_URL = import.meta.env.BASE_URL || '/';

/**
 * Загрузка конфига админки из localStorage (если есть)
 */
function loadAdminConfig() {
  try {
    const raw = localStorage.getItem('flipbook-admin-config');
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённые данные — игнорируем */ }
  return null;
}

const adminConfig = loadAdminConfig();

// Резолвить путь к файлу главы (data: / blob: / http / относительный)
function resolveChapterFile(value) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// Если контент главы хранится inline (htmlContent) — создать blob URL
function resolveChapterWithContent(ch) {
  const result = {
    id: ch.id,
    bg: ch.bg ? (ch.bg.startsWith('data:') || ch.bg.startsWith('http') ? ch.bg : `${BASE_URL}${ch.bg}`) : '',
    bgMobile: ch.bgMobile ? (ch.bgMobile.startsWith('data:') || ch.bgMobile.startsWith('http') ? ch.bgMobile : `${BASE_URL}${ch.bgMobile}`) : '',
  };

  if (ch.htmlContent) {
    // Inline HTML-контент → blob URL для fetch
    const blob = new Blob([ch.htmlContent], { type: 'text/html' });
    result.file = URL.createObjectURL(blob);
  } else {
    result.file = resolveChapterFile(ch.file);
  }

  return result;
}

// Главы: из админки (с добавлением BASE_URL) или дефолтные
const CHAPTERS = adminConfig?.chapters?.length
  ? adminConfig.chapters.map(ch => resolveChapterWithContent(ch))
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

// Настройки по умолчанию: из админки или захардкоженные
const adminDefaults = adminConfig?.defaultSettings || {};

// Оформление книги: из админки или дефолтные
const adminAppearance = adminConfig?.appearance || {};

// Обложка: из админки или дефолтные
const adminCover = adminConfig?.cover || {};

// Звуки: из админки или дефолтные
const adminSounds = adminConfig?.sounds || {};

// Фон обложки: из админки (с добавлением BASE_URL) или дефолтные
function resolveCoverBg(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  return value.startsWith('http') ? value : `${BASE_URL}${value}`;
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
    if (!f.builtin && f.dataUrl) {
      customFonts.push({ id: f.id, label: f.label, family: f.family, dataUrl: f.dataUrl });
    }
  }
  return { fonts, fontsList: adminReadingFonts.filter(f => f.enabled), customFonts };
}

const fontsResult = buildFontsConfig(adminConfig?.readingFonts);

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",
  COVER_BG: resolveCoverBg(adminCover.bg, 'images/backgrounds/bg-cover.webp'),
  COVER_BG_MOBILE: resolveCoverBg(adminCover.bgMobile, 'images/backgrounds/bg-cover-mobile.webp'),

  CHAPTERS,

  FONTS: fontsResult.fonts,

  // Список шрифтов с метаданными (для генерации <select>)
  FONTS_LIST: fontsResult.fontsList,

  // Кастомные шрифты (нужна загрузка через FontFace)
  CUSTOM_FONTS: fontsResult.customFonts || [],

  // Декоративный шрифт (для заголовков)
  DECORATIVE_FONT: adminConfig?.decorativeFont || null,

  SOUNDS: {
    pageFlip: resolveSound(adminSounds.pageFlip, 'sounds/page-flip.mp3'),
    bookOpen: resolveSound(adminSounds.bookOpen, 'sounds/cover-flip.mp3'),
    bookClose: resolveSound(adminSounds.bookClose, 'sounds/cover-flip.mp3'),
  },

  // Конфигурация ambient звуков
  // Из админки (с фильтрацией по visible) или дефолтные
  AMBIENT: buildAmbientConfig(adminConfig?.ambients),

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

  // Настройки оформления из админки
  APPEARANCE: {
    coverTitle: adminCover.title || 'О хоббитах',
    coverAuthor: adminCover.author || 'Дж.Р.Р.Толкин',
    fontMin: adminAppearance.fontMin ?? 14,
    fontMax: adminAppearance.fontMax ?? 22,
    light: {
      coverBgStart: adminAppearance.light?.coverBgStart || '#3a2d1f',
      coverBgEnd: adminAppearance.light?.coverBgEnd || '#2a2016',
      coverText: adminAppearance.light?.coverText || '#f2e9d8',
      coverBgImage: adminAppearance.light?.coverBgImage || null,
      pageTexture: adminAppearance.light?.pageTexture || 'default',
      customTextureData: adminAppearance.light?.customTextureData || null,
      bgPage: adminAppearance.light?.bgPage || '#fdfcf8',
      bgApp: adminAppearance.light?.bgApp || '#e6e3dc',
    },
    dark: {
      coverBgStart: adminAppearance.dark?.coverBgStart || '#111111',
      coverBgEnd: adminAppearance.dark?.coverBgEnd || '#000000',
      coverText: adminAppearance.dark?.coverText || '#eaeaea',
      coverBgImage: adminAppearance.dark?.coverBgImage || null,
      pageTexture: adminAppearance.dark?.pageTexture || 'none',
      customTextureData: adminAppearance.dark?.customTextureData || null,
      bgPage: adminAppearance.dark?.bgPage || '#1e1e1e',
      bgApp: adminAppearance.dark?.bgApp || '#121212',
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
    cacheLimit: 12,
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
  },

  // Настройки аудио
  AUDIO: {
    // Задержка перед возобновлением ambient при возврате на вкладку (мс)
    VISIBILITY_RESUME_DELAY: 100,
  },
});

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