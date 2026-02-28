/**
 * CONFIGURATION
 *
 * Централизованное хранилище настроек.
 *
 * API:
 * - createConfig(adminConfig) — чистая фабричная функция, не обращается к localStorage.
 *   Используется для тестирования и создания конфигурации с явными данными.
 * - createConfigFromAPI(bookDetail, globalSettings, readingFonts) — создание конфига
 *   из серверных данных (Фаза 3).
 * - loadConfigFromAPI(apiClient, bookId) — загрузка конфига из API.
 * - CONFIG — синглтон для production. Вычисляется один раз при загрузке модуля.
 *   Единственный side effect этого модуля: читает localStorage через loadAdminConfig().
 */

import {
  BASE_URL,
  loadAdminConfig,
  deepFreeze,
  resolveAssetPath,
  resolveCoverBgFromCover,
  resolveSound,
  getActiveBook,
  buildAmbientConfig,
  buildFontsConfig,
  buildCommonConfig,
} from './config/configHelpers.js';

export { enrichConfigFromIDB } from './config/enrichConfigFromIDB.js';

// ─── Фабричная функция (из localStorage / admin config) ─────────────────────

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
          title: '',
          file: `${BASE_URL}content/part_1.html`,
          htmlContent: null,
          _idb: false,
          bg: `${BASE_URL}images/backgrounds/part_1.webp`,
          bgMobile: `${BASE_URL}images/backgrounds/part_1-mobile.webp`,
        },
        {
          id: "part_2",
          title: '',
          file: `${BASE_URL}content/part_2.html`,
          htmlContent: null,
          _idb: false,
          bg: `${BASE_URL}images/backgrounds/part_2.webp`,
          bgMobile: `${BASE_URL}images/backgrounds/part_2-mobile.webp`,
        },
        {
          id: "part_3",
          title: '',
          file: `${BASE_URL}content/part_3.html`,
          htmlContent: null,
          _idb: false,
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

  return deepFreeze({
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
        _idbCoverBgImage: bookAppearance.light?._idbCoverBgImage || false,
        pageTexture: bookAppearance.light?.pageTexture || 'default',
        customTextureData: bookAppearance.light?.customTextureData || null,
        _idbCustomTexture: bookAppearance.light?._idbCustomTexture || false,
        bgPage: bookAppearance.light?.bgPage || '#fdfcf8',
        bgApp: bookAppearance.light?.bgApp || '#e6e3dc',
      },
      dark: {
        coverBgStart: bookAppearance.dark?.coverBgStart || '#111111',
        coverBgEnd: bookAppearance.dark?.coverBgEnd || '#000000',
        coverText: bookAppearance.dark?.coverText || '#eaeaea',
        coverBgImage: bookAppearance.dark?.coverBgImage || null,
        _idbCoverBgImage: bookAppearance.dark?._idbCoverBgImage || false,
        pageTexture: bookAppearance.dark?.pageTexture || 'none',
        customTextureData: bookAppearance.dark?.customTextureData || null,
        _idbCustomTexture: bookAppearance.dark?._idbCustomTexture || false,
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

    ...buildCommonConfig(),
  });
}

// ─── Фабричная функция (из серверного API) ──────────────────────────────────

/**
 * Создать конфигурацию из серверных данных (Фаза 3).
 *
 * Принимает данные из API (BookDetail, GlobalSettings, ReadingFont[])
 * и формирует CONFIG в том же формате, что createConfig().
 *
 * @param {Object} bookDetail - Полная информация о книге из GET /api/books/:bookId
 * @param {Object|null} globalSettings - Глобальные настройки из GET /api/settings
 * @param {Array} readingFonts - Шрифты для чтения из GET /api/fonts
 * @returns {Readonly<Object>}
 */
export function createConfigFromAPI(bookDetail, globalSettings, readingFonts) {
  // Главы: из API (id, title, filePath, hasHtmlContent, bg, bgMobile)
  // htmlContent грузится отдельно через ContentLoader → API
  const CHAPTERS = bookDetail.chapters?.length
    ? bookDetail.chapters.map(ch => ({
        id: ch.id,
        title: ch.title || '',
        file: resolveAssetPath(ch.filePath),
        htmlContent: null, // Контент загружается через API отдельно
        _idb: false,
        _hasHtmlContent: ch.hasHtmlContent, // Маркер: контент на сервере
        bg: resolveAssetPath(ch.bg),
        bgMobile: resolveAssetPath(ch.bgMobile),
      }))
    : [];

  const cover = bookDetail.cover || {};
  const appearance = bookDetail.appearance || {};
  const sounds = bookDetail.sounds || {};
  const defaults = bookDetail.defaultSettings || {};

  // Обложка: режимы default/none/custom
  let coverBg = `${BASE_URL}images/backgrounds/bg-cover.webp`;
  let coverBgMobile = `${BASE_URL}images/backgrounds/bg-cover-mobile.webp`;
  if (cover.bgMode === 'none') {
    coverBg = null;
    coverBgMobile = null;
  } else if (cover.bgMode === 'custom' && cover.bgCustomUrl) {
    coverBg = cover.bgCustomUrl;
    coverBgMobile = cover.bgCustomUrl;
  } else {
    if (cover.bg) coverBg = resolveAssetPath(cover.bg);
    if (cover.bgMobile) coverBgMobile = resolveAssetPath(cover.bgMobile);
  }

  // Амбиенты из API формата → CONFIG формат
  const ambientConfig = {};
  if (bookDetail.ambients?.length) {
    for (const a of bookDetail.ambients) {
      if (!a.visible) continue;
      ambientConfig[a.ambientKey || a.id] = {
        label: a.label,
        shortLabel: a.shortLabel || a.label,
        icon: a.icon,
        file: a.fileUrl ? resolveAssetPath(a.fileUrl) : null,
      };
    }
  }
  // Если нет амбиентов — дефолтные
  const AMBIENT = Object.keys(ambientConfig).length > 0
    ? ambientConfig
    : {
        none: { label: "Без звука", shortLabel: "Нет", icon: "✕", file: null },
        rain: { label: "Дождь", shortLabel: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
        fireplace: { label: "Камин", shortLabel: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
        cafe: { label: "Кафе", shortLabel: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
      };

  // Шрифты из API → CONFIG формат
  const fonts = {};
  const fontsList = [];
  const customFonts = [];
  if (readingFonts?.length) {
    for (const f of readingFonts) {
      if (!f.enabled) continue;
      const key = f.fontKey || f.id;
      fonts[key] = f.family;
      fontsList.push({ id: key, label: f.label, family: f.family, builtin: f.builtin, enabled: f.enabled });
      if (!f.builtin && f.fileUrl) {
        customFonts.push({ id: key, label: f.label, family: f.family, dataUrl: f.fileUrl });
      }
    }
  }
  const FONTS = Object.keys(fonts).length > 0
    ? fonts
    : {
        georgia: "Georgia, serif",
        merriweather: '"Merriweather", serif',
        "libre-baskerville": '"Libre Baskerville", serif',
        inter: "Inter, sans-serif",
        roboto: "Roboto, sans-serif",
        "open-sans": '"Open Sans", sans-serif',
      };

  // Декоративный шрифт
  const decorativeFont = bookDetail.decorativeFont
    ? { name: bookDetail.decorativeFont.name, dataUrl: bookDetail.decorativeFont.fileUrl }
    : null;

  // Видимость настроек
  const vis = globalSettings?.settingsVisibility || {};

  return deepFreeze({
    STORAGE_KEY: `reader-settings:${bookDetail.id}`,
    BOOK_ID: bookDetail.id,
    COVER_BG: coverBg,
    COVER_BG_MOBILE: coverBgMobile,

    CHAPTERS,

    FONTS,
    FONTS_LIST: fontsList.length > 0 ? fontsList : null,
    CUSTOM_FONTS: customFonts,
    DECORATIVE_FONT: decorativeFont,

    SOUNDS: {
      pageFlip: resolveSound(sounds.pageFlip, 'sounds/page-flip.mp3'),
      bookOpen: resolveSound(sounds.bookOpen, 'sounds/cover-flip.mp3'),
      bookClose: resolveSound(sounds.bookClose, 'sounds/cover-flip.mp3'),
    },

    AMBIENT,

    DEFAULT_SETTINGS: {
      font: defaults.font || "georgia",
      fontSize: defaults.fontSize || 18,
      theme: defaults.theme || "light",
      page: 0,
      soundEnabled: defaults.soundEnabled ?? true,
      soundVolume: defaults.soundVolume ?? 0.3,
      ambientType: defaults.ambientType || 'none',
      ambientVolume: defaults.ambientVolume ?? 0.5
    },

    APPEARANCE: {
      coverTitle: bookDetail.title || '',
      coverAuthor: bookDetail.author || '',
      fontMin: appearance.fontMin ?? globalSettings?.fontMin ?? 14,
      fontMax: appearance.fontMax ?? globalSettings?.fontMax ?? 22,
      light: {
        coverBgStart: appearance.light?.coverBgStart || '#3a2d1f',
        coverBgEnd: appearance.light?.coverBgEnd || '#2a2016',
        coverText: appearance.light?.coverText || '#f2e9d8',
        coverBgImage: appearance.light?.coverBgImageUrl || null,
        pageTexture: appearance.light?.pageTexture || 'default',
        customTextureData: appearance.light?.customTextureUrl || null,
        bgPage: appearance.light?.bgPage || '#fdfcf8',
        bgApp: appearance.light?.bgApp || '#e6e3dc',
      },
      dark: {
        coverBgStart: appearance.dark?.coverBgStart || '#111111',
        coverBgEnd: appearance.dark?.coverBgEnd || '#000000',
        coverText: appearance.dark?.coverText || '#eaeaea',
        coverBgImage: appearance.dark?.coverBgImageUrl || null,
        pageTexture: appearance.dark?.pageTexture || 'none',
        customTextureData: appearance.dark?.customTextureUrl || null,
        bgPage: appearance.dark?.bgPage || '#1e1e1e',
        bgApp: appearance.dark?.bgApp || '#121212',
      },
    },

    SETTINGS_VISIBILITY: {
      fontSize: vis.fontSize ?? true,
      theme: vis.theme ?? true,
      font: vis.font ?? true,
      fullscreen: vis.fullscreen ?? true,
      sound: vis.sound ?? true,
      ambient: vis.ambient ?? true,
    },

    ...buildCommonConfig(),
  });
}

/**
 * Загрузить конфигурацию из серверного API.
 *
 * @param {import('./utils/ApiClient.js').ApiClient} apiClient
 * @param {string} bookId - ID книги для загрузки
 * @returns {Promise<Readonly<Object>>} CONFIG
 */
export async function loadConfigFromAPI(apiClient, bookId) {
  const [bookDetail, globalSettings, readingFonts] = await Promise.all([
    apiClient.getBook(bookId),
    apiClient.getSettings().catch(() => null),
    apiClient.getFonts().catch(() => []),
  ]);

  return createConfigFromAPI(bookDetail, globalSettings, readingFonts);
}

// ─── Управляемый синглтон ────────────────────────────────────────────────────

/**
 * Внутреннее хранилище конфигурации.
 * Заменяемо через setConfig() для тестирования и runtime-обновлений.
 * @type {Readonly<Object>}
 */
let _activeConfig = createConfig(loadAdminConfig());

/**
 * Конфигурация приложения, вычисленная из данных в localStorage.
 *
 * Для простоты — экспортируется как статичная ссылка (обратная совместимость).
 * Для тестирования и runtime-обновлений используйте getConfig() / setConfig().
 */
export const CONFIG = _activeConfig;

/**
 * Получить текущую активную конфигурацию.
 * В отличие от CONFIG (статичная ссылка), getConfig() всегда возвращает
 * актуальный объект, даже после вызова setConfig().
 *
 * Рекомендуется для новых компонентов и тестов.
 * @returns {Readonly<Object>}
 */
export function getConfig() {
  return _activeConfig;
}

/**
 * Заменить активную конфигурацию.
 *
 * Использование:
 * - В тестах: setConfig(createConfig(mockAdminConfig))
 * - При переключении книги (runtime): setConfig(createConfig(newAdminConfig))
 * - При загрузке с сервера: setConfig(createConfigFromAPI(...))
 *
 * @param {Readonly<Object>} config - Новый объект конфигурации
 */
export function setConfig(config) {
  _activeConfig = config;
}

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
