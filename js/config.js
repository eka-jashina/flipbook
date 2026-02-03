/**
 * CONFIGURATION
 * 
 * Централизованное хранилище настроек.
 */

// Vite подставляет base URL для production
const BASE_URL = import.meta.env.BASE_URL || '/';

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",
  COVER_BG: `${BASE_URL}images/backgrounds/bg-cover.webp`,
  COVER_BG_MOBILE: `${BASE_URL}images/backgrounds/bg-cover-mobile.webp`,

  CHAPTERS: [
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
  ],

  FONTS: {
    georgia: "Georgia, serif",
    merriweather: '"Merriweather", serif',
    "libre-baskerville": '"Libre Baskerville", serif',
    inter: "Inter, sans-serif",
    roboto: "Roboto, sans-serif",
    "open-sans": '"Open Sans", sans-serif',
  },

  SOUNDS: {
    pageFlip: `${BASE_URL}sounds/page-flip.mp3`,
    bookOpen: `${BASE_URL}sounds/cover-flip.mp3`,
    bookClose:`${BASE_URL}sounds/cover-flip.mp3`,
  },

  // Конфигурация ambient звуков
  // Для добавления нового типа достаточно добавить запись сюда
  AMBIENT: {
    none: { label: "Без звука", shortLabel: "Нет", icon: "✕", file: null },
    rain: { label: "Дождь", shortLabel: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
    fireplace: { label: "Камин", shortLabel: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
    cafe: { label: "Кафе", shortLabel: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
  },

 DEFAULT_SETTINGS: {
    font: "georgia",
    fontSize: 18,
    theme: "light",
    page: 0,
    soundEnabled: true,
    soundVolume: 0.3,
    ambientType: 'none',
    ambientVolume: 0.5
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

  TIMING_SAFETY_MARGIN: 100
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