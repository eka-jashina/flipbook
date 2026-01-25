/**
 * CONFIGURATION
 * 
 * Централизованное хранилище настроек.
 */

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",
  COVER_BG: "/images/backgrounds/bg-cover.webp",

  CHAPTERS: [
    { id: "part_1", file: "/content/part_1.html", bg: "/images/backgrounds/part_1.webp" },
    { id: "part_2", file: "/content/part_2.html", bg: "/images/backgrounds/part_2.webp" },
    { id: "part_3", file: "/content/part_3.html", bg: "/images/backgrounds/part_3.webp" },
  ],

  FONTS: {
    georgia: "Georgia, serif",
    merriweather: '"Merriweather", serif',
    "libre-baskerville": '"Libre Baskerville", serif',
    inter: "Inter, sans-serif",
    roboto: "Roboto, sans-serif",
    "open-sans": '"Open Sans", sans-serif',
  },

  DEFAULT_SETTINGS: {
    font: "georgia",
    fontSize: 18,
    theme: "light",
    page: 0,
  },

  VIRTUALIZATION: {
    cacheLimit: 12,
    preloadWindow: 4,
    observerRootMargin: "200px",
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
