/**
 * AdminConfigDefaults
 *
 * Дефолтные значения конфигурации для AdminConfigStore.
 * Чистые константы — не содержат бизнес-логики.
 *
 * Экспортируются отдельно, чтобы AdminConfigStore не смешивал данные с логикой,
 * а тесты могли проверять ожидаемые дефолты независимо.
 */

// Per-theme дефолты внешнего вида
export const LIGHT_DEFAULTS = {
  coverBgStart: '#3a2d1f',
  coverBgEnd: '#2a2016',
  coverText: '#f2e9d8',
  coverBgImage: null,
  pageTexture: 'default',
  customTextureData: null,
  bgPage: '#fdfcf8',
  bgApp: '#e6e3dc',
};

export const DARK_DEFAULTS = {
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
export const DEFAULT_READING_FONTS = [
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", serif', builtin: true, enabled: true },
  { id: 'libre-baskerville', label: 'Libre Baskerville', family: '"Libre Baskerville", serif', builtin: true, enabled: true },
  { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true },
  { id: 'roboto', label: 'Roboto', family: 'Roboto, sans-serif', builtin: true, enabled: true },
  { id: 'open-sans', label: 'Open Sans', family: '"Open Sans", sans-serif', builtin: true, enabled: true },
];

// Дефолтные per-book настройки
export const DEFAULT_BOOK_SETTINGS = {
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
export const DEFAULT_BOOK = {
  id: 'default',
  cover: {
    title: 'О хоббитах',
    author: 'Дж.Р.Р.Толкин',
    bg: 'images/backgrounds/bg-cover.webp',
    bgMobile: 'images/backgrounds/bg-cover-mobile.webp',
    bgMode: 'default',
    bgCustomData: null,
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

// Дефолтная конфигурация верхнего уровня
export const DEFAULT_CONFIG = {
  books: [structuredClone(DEFAULT_BOOK)],
  activeBookId: 'default',
  // Global: диапазон размера шрифта
  fontMin: 14,
  fontMax: 22,
  // Global: шрифты для чтения
  readingFonts: structuredClone(DEFAULT_READING_FONTS),
  // Global: видимость настроек ридера
  settingsVisibility: {
    fontSize: true,
    theme: true,
    font: true,
    fullscreen: true,
    sound: true,
    ambient: true,
  },
};
