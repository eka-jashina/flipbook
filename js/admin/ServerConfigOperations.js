/**
 * SERVER CONFIG OPERATIONS
 *
 * Вспомогательные функции для ServerAdminConfigStore.
 * Выделены из монолитного файла для снижения размера и улучшения читаемости.
 *
 * Группы операций:
 * - Главы (chapters)
 * - Медиа (sounds, ambients, decorativeFont, readingFonts)
 * - Оформление (appearance, settingsVisibility, defaultSettings)
 */

// ─── Главы (chapters) ────────────────────────────────────────────────────────

/**
 * Загрузить главы активной книги через API.
 * @param {Object} api - ApiClient
 * @param {string} bookId - ID активной книги
 * @returns {Promise<Array>}
 */
export async function fetchChapters(api, bookId) {
  const result = await api.getChapters(bookId);
  const chapters = result.chapters || result;
  return chapters.map(ch => ({
    id: ch.id,
    title: ch.title,
    file: ch.filePath || '',
    htmlContent: null,
    _hasHtmlContent: ch.hasHtmlContent,
    bg: ch.bg,
    bgMobile: ch.bgMobile,
  }));
}

/**
 * Создать главу через API.
 * @param {Object} api
 * @param {string} bookId
 * @param {Object} chapter
 */
export async function createChapter(api, bookId, chapter) {
  await api.createChapter(bookId, {
    title: chapter.title || '',
    htmlContent: chapter.htmlContent || null,
    filePath: chapter.file || null,
    bg: chapter.bg || '',
    bgMobile: chapter.bgMobile || '',
  });
}

/**
 * Обновить главу через API (по индексу).
 * @param {Object} api
 * @param {string} bookId
 * @param {number} index
 * @param {Object} chapter
 */
export async function updateChapterByIndex(api, bookId, index, chapter) {
  const result = await api.getChapters(bookId);
  const chapters = result.chapters || result;
  if (index < 0 || index >= chapters.length) return;
  const chapterId = chapters[index].id;

  await api.updateChapter(bookId, chapterId, {
    title: chapter.title,
    htmlContent: chapter.htmlContent,
    filePath: chapter.file,
    bg: chapter.bg,
    bgMobile: chapter.bgMobile,
  });
}

/**
 * Удалить главу через API (по индексу).
 * @param {Object} api
 * @param {string} bookId
 * @param {number} index
 */
export async function removeChapterByIndex(api, bookId, index) {
  const result = await api.getChapters(bookId);
  const chapters = result.chapters || result;
  if (index < 0 || index >= chapters.length) return;
  await api.deleteChapter(bookId, chapters[index].id);
}

/**
 * Переместить главу через API (reorder).
 * @param {Object} api
 * @param {string} bookId
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export async function moveChapterByIndex(api, bookId, fromIndex, toIndex) {
  const result = await api.getChapters(bookId);
  const chapters = result.chapters || result;
  if (fromIndex < 0 || fromIndex >= chapters.length) return;
  if (toIndex < 0 || toIndex >= chapters.length) return;

  const ids = chapters.map(ch => ch.id);
  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved);

  await api.reorderChapters(bookId, ids);
}

// ─── Амбиенты ────────────────────────────────────────────────────────────────

/**
 * Загрузить амбиенты активной книги через API.
 * @param {Object} api
 * @param {string} bookId
 * @returns {Promise<Array>}
 */
export async function fetchAmbients(api, bookId) {
  const result = await api.getAmbients(bookId);
  const ambients = result.ambients || result;
  return ambients.map(a => ({
    id: a.ambientKey || a.id,
    label: a.label,
    shortLabel: a.shortLabel || a.label,
    icon: a.icon,
    file: a.fileUrl,
    visible: a.visible,
    builtin: a.builtin,
    _serverId: a.id,
  }));
}

/**
 * Создать амбиент через API.
 * @param {Object} api
 * @param {string} bookId
 * @param {Object} ambient
 */
export async function createAmbient(api, bookId, ambient) {
  await api.createAmbient(bookId, {
    ambientKey: ambient.id || `ambient_${Date.now()}`,
    label: ambient.label,
    shortLabel: ambient.shortLabel || ambient.label,
    icon: ambient.icon || '',
    fileUrl: ambient.file || null,
    visible: ambient.visible ?? true,
    builtin: ambient.builtin ?? false,
  });
}

/**
 * Обновить амбиент через API (по индексу).
 * @param {Object} api
 * @param {string} bookId
 * @param {number} index
 * @param {Object} data
 */
export async function updateAmbientByIndex(api, bookId, index, data) {
  const result = await api.getAmbients(bookId);
  const ambients = result.ambients || result;
  if (index < 0 || index >= ambients.length) return;

  const updateData = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.shortLabel !== undefined) updateData.shortLabel = data.shortLabel;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.file !== undefined) updateData.fileUrl = data.file;
  if (data.visible !== undefined) updateData.visible = data.visible;

  await api.updateAmbient(bookId, ambients[index].id, updateData);
}

/**
 * Удалить амбиент через API (по индексу).
 * @param {Object} api
 * @param {string} bookId
 * @param {number} index
 */
export async function removeAmbientByIndex(api, bookId, index) {
  const result = await api.getAmbients(bookId);
  const ambients = result.ambients || result;
  if (index < 0 || index >= ambients.length) return;
  await api.deleteAmbient(bookId, ambients[index].id);
}

// ─── Шрифты для чтения (global) ─────────────────────────────────────────────

/**
 * Загрузить шрифты для чтения через API.
 * @param {Object} api
 * @returns {Promise<Array>}
 */
export async function fetchReadingFonts(api) {
  const result = await api.getFonts();
  const fonts = result.fonts || result;
  return fonts.map(f => ({
    id: f.fontKey || f.id,
    label: f.label,
    family: f.family,
    builtin: f.builtin,
    enabled: f.enabled,
    dataUrl: f.fileUrl || null,
    _serverId: f.id,
  }));
}

/**
 * Создать шрифт через API.
 * @param {Object} api
 * @param {Object} font
 */
export async function createReadingFont(api, font) {
  await api.createFont({
    fontKey: font.id || `font_${Date.now()}`,
    label: font.label,
    family: font.family,
    builtin: font.builtin ?? false,
    enabled: font.enabled ?? true,
    fileUrl: font.dataUrl || null,
  });
}

/**
 * Обновить шрифт через API (по индексу).
 * @param {Object} api
 * @param {number} index
 * @param {Object} data
 */
export async function updateReadingFontByIndex(api, index, data) {
  const result = await api.getFonts();
  const fonts = result.fonts || result;
  if (index < 0 || index >= fonts.length) return;

  const updateData = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.family !== undefined) updateData.family = data.family;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.dataUrl !== undefined) updateData.fileUrl = data.dataUrl;

  await api.updateFont(fonts[index].id, updateData);
}

/**
 * Удалить шрифт через API (по индексу).
 * @param {Object} api
 * @param {number} index
 */
export async function removeReadingFontByIndex(api, index) {
  const result = await api.getFonts();
  const fonts = result.fonts || result;
  if (index < 0 || index >= fonts.length) return;
  await api.deleteFont(fonts[index].id);
}

// ─── Оформление (appearance) ─────────────────────────────────────────────────

/**
 * Маппинг полей темы: internal → API.
 * @param {Object} data
 * @returns {Object}
 */
export function mapThemeToAPI(data) {
  const apiData = {};
  if (data.coverBgStart !== undefined) apiData.coverBgStart = data.coverBgStart;
  if (data.coverBgEnd !== undefined) apiData.coverBgEnd = data.coverBgEnd;
  if (data.coverText !== undefined) apiData.coverText = data.coverText;
  if (data.coverBgImage !== undefined) apiData.coverBgImageUrl = data.coverBgImage;
  if (data.pageTexture !== undefined) apiData.pageTexture = data.pageTexture;
  if (data.customTextureData !== undefined) apiData.customTextureUrl = data.customTextureData;
  if (data.bgPage !== undefined) apiData.bgPage = data.bgPage;
  if (data.bgApp !== undefined) apiData.bgApp = data.bgApp;
  return apiData;
}

/**
 * Маппинг полей темы: API → internal.
 * @param {Object} apiTheme
 * @returns {Object}
 */
export function mapThemeFromAPI(apiTheme) {
  if (!apiTheme) return {};
  return {
    coverBgStart: apiTheme.coverBgStart,
    coverBgEnd: apiTheme.coverBgEnd,
    coverText: apiTheme.coverText,
    coverBgImage: apiTheme.coverBgImageUrl,
    pageTexture: apiTheme.pageTexture,
    customTextureData: apiTheme.customTextureUrl,
    bgPage: apiTheme.bgPage,
    bgApp: apiTheme.bgApp,
  };
}

/**
 * Маппинг видимости настроек: internal → API.
 * @param {Object} data
 * @returns {Object}
 */
export function mapVisibilityToAPI(data) {
  const apiData = {};
  if (data.fontSize !== undefined) apiData.visFontSize = data.fontSize;
  if (data.theme !== undefined) apiData.visTheme = data.theme;
  if (data.font !== undefined) apiData.visFont = data.font;
  if (data.fullscreen !== undefined) apiData.visFullscreen = data.fullscreen;
  if (data.sound !== undefined) apiData.visSound = data.sound;
  if (data.ambient !== undefined) apiData.visAmbient = data.ambient;
  return apiData;
}
