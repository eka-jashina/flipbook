/**
 * ServerAdminConfigStore
 *
 * Адаптер с тем же интерфейсом, что у AdminConfigStore,
 * но внутри — вызовы серверного API вместо IndexedDB/localStorage.
 *
 * 10 admin-модулей (ChaptersModule, SoundsModule, ...) продолжают работать
 * без изменений через this.store.* — методы становятся async.
 *
 * Решение ADR Фаза 3: замена одной строки при инициализации:
 *   AdminConfigStore.create() → ServerAdminConfigStore.create(apiClient)
 */

export class ServerAdminConfigStore {
  /**
   * @param {import('../utils/ApiClient.js').ApiClient} apiClient
   */
  constructor(apiClient) {
    this._api = apiClient;
    this._activeBookId = null;
    this._books = [];
    this._savePromise = null;
    /** @type {Function|null} Колбэк для уведомления UI об ошибках: (message: string) => void */
    this._onError = null;
  }

  /**
   * Установить обработчик ошибок (для показа toast в AdminApp)
   * @param {Function} callback - (message: string) => void
   */
  set onError(callback) {
    this._onError = callback;
  }

  /**
   * Уведомить об ошибке через колбэк
   * @private
   * @param {string} action - Описание действия
   * @param {Error} err - Ошибка
   */
  _handleError(action, err) {
    const message = `${action}: ${err.message || 'Ошибка сервера'}`;
    console.error(message, err);
    if (this._onError) this._onError(message);
  }

  /**
   * Асинхронная фабрика — загружает данные с сервера
   * @param {import('../utils/ApiClient.js').ApiClient} apiClient
   * @returns {Promise<ServerAdminConfigStore>}
   */
  static async create(apiClient) {
    const store = new ServerAdminConfigStore(apiClient);
    await store._init();
    return store;
  }

  /** Инициализация: загрузка списка книг */
  async _init() {
    this._books = await this._api.getBooks();
    if (this._books.length > 0) {
      this._activeBookId = this._books[0].id;
    }
  }

  /** Нотификация о сохранении (для перехвата в AdminApp._showSaveIndicator) */
  _save() {
    // В серверном адаптере _save() — no-op, используется для совместимости
    // с перехватом в AdminApp: originalSave = this.store._save.bind(...)
  }

  /** Дождаться завершения последнего запроса */
  async waitForSave() {
    if (this._savePromise) {
      await this._savePromise;
    }
  }

  // --- Книги ---

  /** Список всех книг (краткая инфо) */
  getBooks() {
    return this._books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      chaptersCount: b.chaptersCount || 0,
    }));
  }

  /** ID активной книги */
  getActiveBookId() {
    return this._activeBookId;
  }

  /** Переключить активную книгу */
  setActiveBook(bookId) {
    const exists = this._books.some(b => b.id === bookId);
    if (!exists) return;
    this._activeBookId = bookId;
  }

  /** Добавить новую книгу */
  async addBook(book) {
    try {
      const created = await this._api.createBook({
        title: book.cover?.title || book.title || '',
        author: book.cover?.author || book.author || '',
      });
      this._books.push({
        id: created.id,
        title: created.title,
        author: created.author,
        chaptersCount: 0,
      });
      this._save();
      return created;
    } catch (err) {
      this._handleError('Не удалось создать книгу', err);
      throw err;
    }
  }

  /** Переместить книгу */
  async moveBook(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this._books.length) return;
    if (toIndex < 0 || toIndex >= this._books.length) return;

    const [moved] = this._books.splice(fromIndex, 1);
    this._books.splice(toIndex, 0, moved);

    try {
      this._savePromise = this._api.reorderBooks(this._books.map(b => b.id));
      await this._savePromise;
      this._save();
    } catch (err) {
      // Откат порядка
      this._books.splice(toIndex, 1);
      this._books.splice(fromIndex, 0, moved);
      this._handleError('Не удалось переместить книгу', err);
      throw err;
    }
  }

  /** Удалить книгу */
  async removeBook(bookId) {
    try {
      await this._api.deleteBook(bookId);
      this._books = this._books.filter(b => b.id !== bookId);
      if (this._activeBookId === bookId) {
        this._activeBookId = this._books.length > 0 ? this._books[0].id : '';
      }
      this._save();
    } catch (err) {
      this._handleError('Не удалось удалить книгу', err);
      throw err;
    }
  }

  /** Переименовать книгу */
  async updateBookMeta(bookId, meta) {
    try {
      await this._api.updateBook(bookId, {
        title: meta.title,
        author: meta.author,
      });
      const book = this._books.find(b => b.id === bookId);
      if (book) {
        if (meta.title !== undefined) book.title = meta.title;
        if (meta.author !== undefined) book.author = meta.author;
      }
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить книгу', err);
      throw err;
    }
  }

  // --- Обложка (активной книги) ---

  async getCover() {
    if (!this._activeBookId) return { title: '', author: '', bg: '', bgMobile: '' };
    const book = await this._api.getBook(this._activeBookId);
    return {
      title: book.title,
      author: book.author,
      bg: book.cover?.bg || '',
      bgMobile: book.cover?.bgMobile || '',
      bgMode: book.cover?.bgMode || 'default',
      bgCustomData: book.cover?.bgCustomUrl || null,
    };
  }

  async updateCover(cover) {
    if (!this._activeBookId) return;
    const data = {};
    if (cover.title !== undefined) data.title = cover.title;
    if (cover.author !== undefined) data.author = cover.author;
    if (cover.bgMode !== undefined) data.coverBgMode = cover.bgMode;
    if (cover.bgCustomData !== undefined) data.coverBgCustomUrl = cover.bgCustomData;

    try {
      await this._api.updateBook(this._activeBookId, data);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить обложку', err);
      throw err;
    }
  }

  // --- Главы (активной книги) ---

  async getChapters() {
    if (!this._activeBookId) return [];
    const chapters = await this._api.getChapters(this._activeBookId);
    return chapters.map(ch => ({
      id: ch.id,
      title: ch.title,
      file: ch.filePath || '',
      htmlContent: null, // Контент загружается отдельно
      _hasHtmlContent: ch.hasHtmlContent,
      bg: ch.bg,
      bgMobile: ch.bgMobile,
    }));
  }

  async addChapter(chapter) {
    if (!this._activeBookId) return;
    try {
      await this._api.createChapter(this._activeBookId, {
        title: chapter.title || '',
        htmlContent: chapter.htmlContent || null,
        filePath: chapter.file || null,
        bg: chapter.bg || '',
        bgMobile: chapter.bgMobile || '',
      });
      this._save();
    } catch (err) {
      this._handleError('Не удалось добавить главу', err);
      throw err;
    }
  }

  async updateChapter(index, chapter) {
    if (!this._activeBookId) return;
    try {
      const chapters = await this._api.getChapters(this._activeBookId);
      if (index < 0 || index >= chapters.length) return;
      const chapterId = chapters[index].id;

      await this._api.updateChapter(this._activeBookId, chapterId, {
        title: chapter.title,
        htmlContent: chapter.htmlContent,
        filePath: chapter.file,
        bg: chapter.bg,
        bgMobile: chapter.bgMobile,
      });
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить главу', err);
      throw err;
    }
  }

  async removeChapter(index) {
    if (!this._activeBookId) return;
    try {
      const chapters = await this._api.getChapters(this._activeBookId);
      if (index < 0 || index >= chapters.length) return;

      await this._api.deleteChapter(this._activeBookId, chapters[index].id);
      this._save();
    } catch (err) {
      this._handleError('Не удалось удалить главу', err);
      throw err;
    }
  }

  async moveChapter(fromIndex, toIndex) {
    if (!this._activeBookId) return;
    try {
      const chapters = await this._api.getChapters(this._activeBookId);
      if (fromIndex < 0 || fromIndex >= chapters.length) return;
      if (toIndex < 0 || toIndex >= chapters.length) return;

      const ids = chapters.map(ch => ch.id);
      const [moved] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, moved);

      await this._api.reorderChapters(this._activeBookId, ids);
      this._save();
    } catch (err) {
      this._handleError('Не удалось переместить главу', err);
      throw err;
    }
  }

  // --- Амбиенты (per-book, активной книги) ---

  async getAmbients() {
    if (!this._activeBookId) return [];
    const ambients = await this._api.getAmbients(this._activeBookId);
    return ambients.map(a => ({
      id: a.ambientKey || a.id,
      label: a.label,
      shortLabel: a.shortLabel || a.label,
      icon: a.icon,
      file: a.fileUrl,
      visible: a.visible,
      builtin: a.builtin,
      _serverId: a.id, // Серверный ID для обновления
    }));
  }

  async addAmbient(ambient) {
    if (!this._activeBookId) return;
    try {
      await this._api.createAmbient(this._activeBookId, {
        ambientKey: ambient.id || `ambient_${Date.now()}`,
        label: ambient.label,
        shortLabel: ambient.shortLabel || ambient.label,
        icon: ambient.icon || '',
        fileUrl: ambient.file || null,
        visible: ambient.visible ?? true,
        builtin: ambient.builtin ?? false,
      });
      this._save();
    } catch (err) {
      this._handleError('Не удалось добавить эмбиент', err);
      throw err;
    }
  }

  async updateAmbient(index, data) {
    if (!this._activeBookId) return;
    try {
      const ambients = await this._api.getAmbients(this._activeBookId);
      if (index < 0 || index >= ambients.length) return;

      const updateData = {};
      if (data.label !== undefined) updateData.label = data.label;
      if (data.shortLabel !== undefined) updateData.shortLabel = data.shortLabel;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.file !== undefined) updateData.fileUrl = data.file;
      if (data.visible !== undefined) updateData.visible = data.visible;

      await this._api.updateAmbient(this._activeBookId, ambients[index].id, updateData);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить эмбиент', err);
      throw err;
    }
  }

  async removeAmbient(index) {
    if (!this._activeBookId) return;
    try {
      const ambients = await this._api.getAmbients(this._activeBookId);
      if (index < 0 || index >= ambients.length) return;

      await this._api.deleteAmbient(this._activeBookId, ambients[index].id);
      this._save();
    } catch (err) {
      this._handleError('Не удалось удалить эмбиент', err);
      throw err;
    }
  }

  // --- Звуки (per-book, активной книги) ---

  async getSounds() {
    if (!this._activeBookId) return { pageFlip: '', bookOpen: '', bookClose: '' };
    const sounds = await this._api.getSounds(this._activeBookId);
    return {
      pageFlip: sounds.pageFlip || '',
      bookOpen: sounds.bookOpen || '',
      bookClose: sounds.bookClose || '',
    };
  }

  async updateSounds(sounds) {
    if (!this._activeBookId) return;
    const data = {};
    if (sounds.pageFlip !== undefined) data.pageFlipUrl = sounds.pageFlip;
    if (sounds.bookOpen !== undefined) data.bookOpenUrl = sounds.bookOpen;
    if (sounds.bookClose !== undefined) data.bookCloseUrl = sounds.bookClose;

    try {
      await this._api.updateSounds(this._activeBookId, data);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить звуки', err);
      throw err;
    }
  }

  // --- Настройки по умолчанию (per-book, активной книги) ---

  async getDefaultSettings() {
    if (!this._activeBookId) return {};
    return this._api.getDefaultSettings(this._activeBookId);
  }

  async updateDefaultSettings(settings) {
    if (!this._activeBookId) return;
    try {
      await this._api.updateDefaultSettings(this._activeBookId, settings);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить настройки по умолчанию', err);
      throw err;
    }
  }

  // --- Декоративный шрифт (per-book, активной книги) ---

  async getDecorativeFont() {
    if (!this._activeBookId) return null;
    return this._api.getDecorativeFont(this._activeBookId);
  }

  async setDecorativeFont(fontData) {
    if (!this._activeBookId) return;
    try {
      if (fontData) {
        await this._api.setDecorativeFont(this._activeBookId, {
          name: fontData.name,
          fileUrl: fontData.dataUrl || fontData.fileUrl,
        });
      } else {
        await this._api.deleteDecorativeFont(this._activeBookId);
      }
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить декоративный шрифт', err);
      throw err;
    }
  }

  // --- Шрифты для чтения (global) ---

  async getReadingFonts() {
    const fonts = await this._api.getFonts();
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

  async addReadingFont(font) {
    try {
      await this._api.createFont({
        fontKey: font.id || `font_${Date.now()}`,
        label: font.label,
        family: font.family,
        builtin: font.builtin ?? false,
        enabled: font.enabled ?? true,
        fileUrl: font.dataUrl || null,
      });
      this._save();
    } catch (err) {
      this._handleError('Не удалось добавить шрифт', err);
      throw err;
    }
  }

  async updateReadingFont(index, data) {
    try {
      const fonts = await this._api.getFonts();
      if (index < 0 || index >= fonts.length) return;

      const updateData = {};
      if (data.label !== undefined) updateData.label = data.label;
      if (data.family !== undefined) updateData.family = data.family;
      if (data.enabled !== undefined) updateData.enabled = data.enabled;
      if (data.dataUrl !== undefined) updateData.fileUrl = data.dataUrl;

      await this._api.updateFont(fonts[index].id, updateData);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить шрифт', err);
      throw err;
    }
  }

  async removeReadingFont(index) {
    try {
      const fonts = await this._api.getFonts();
      if (index < 0 || index >= fonts.length) return;

      await this._api.deleteFont(fonts[index].id);
      this._save();
    } catch (err) {
      this._handleError('Не удалось удалить шрифт', err);
      throw err;
    }
  }

  // --- Оформление ---

  async getAppearance() {
    if (!this._activeBookId) return { fontMin: 14, fontMax: 22, light: {}, dark: {} };
    const [appearance, settings] = await Promise.all([
      this._api.getAppearance(this._activeBookId),
      this._api.getSettings().catch(() => null),
    ]);

    return {
      fontMin: settings?.fontMin ?? appearance?.fontMin ?? 14,
      fontMax: settings?.fontMax ?? appearance?.fontMax ?? 22,
      light: appearance?.light ? {
        coverBgStart: appearance.light.coverBgStart,
        coverBgEnd: appearance.light.coverBgEnd,
        coverText: appearance.light.coverText,
        coverBgImage: appearance.light.coverBgImageUrl,
        pageTexture: appearance.light.pageTexture,
        customTextureData: appearance.light.customTextureUrl,
        bgPage: appearance.light.bgPage,
        bgApp: appearance.light.bgApp,
      } : {},
      dark: appearance?.dark ? {
        coverBgStart: appearance.dark.coverBgStart,
        coverBgEnd: appearance.dark.coverBgEnd,
        coverText: appearance.dark.coverText,
        coverBgImage: appearance.dark.coverBgImageUrl,
        pageTexture: appearance.dark.pageTexture,
        customTextureData: appearance.dark.customTextureUrl,
        bgPage: appearance.dark.bgPage,
        bgApp: appearance.dark.bgApp,
      } : {},
    };
  }

  async updateAppearanceGlobal(data) {
    const updateData = {};
    if (data.fontMin !== undefined) updateData.fontMin = data.fontMin;
    if (data.fontMax !== undefined) updateData.fontMax = data.fontMax;

    try {
      if (Object.keys(updateData).length > 0) {
        await this._api.updateSettings(updateData);
      }
      if (this._activeBookId) {
        await this._api.updateAppearance(this._activeBookId, updateData);
      }
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить оформление', err);
      throw err;
    }
  }

  async updateAppearanceTheme(theme, data) {
    if (theme !== 'light' && theme !== 'dark') return;
    if (!this._activeBookId) return;

    const apiData = {};
    if (data.coverBgStart !== undefined) apiData.coverBgStart = data.coverBgStart;
    if (data.coverBgEnd !== undefined) apiData.coverBgEnd = data.coverBgEnd;
    if (data.coverText !== undefined) apiData.coverText = data.coverText;
    if (data.coverBgImage !== undefined) apiData.coverBgImageUrl = data.coverBgImage;
    if (data.pageTexture !== undefined) apiData.pageTexture = data.pageTexture;
    if (data.customTextureData !== undefined) apiData.customTextureUrl = data.customTextureData;
    if (data.bgPage !== undefined) apiData.bgPage = data.bgPage;
    if (data.bgApp !== undefined) apiData.bgApp = data.bgApp;

    try {
      await this._api.updateAppearanceTheme(this._activeBookId, theme, apiData);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить тему оформления', err);
      throw err;
    }
  }

  // --- Видимость настроек (global) ---

  async getSettingsVisibility() {
    const settings = await this._api.getSettings().catch(() => null);
    return settings?.settingsVisibility || {
      fontSize: true, theme: true, font: true,
      fullscreen: true, sound: true, ambient: true,
    };
  }

  async updateSettingsVisibility(data) {
    const apiData = {};
    if (data.fontSize !== undefined) apiData.visFontSize = data.fontSize;
    if (data.theme !== undefined) apiData.visTheme = data.theme;
    if (data.font !== undefined) apiData.visFont = data.font;
    if (data.fullscreen !== undefined) apiData.visFullscreen = data.fullscreen;
    if (data.sound !== undefined) apiData.visSound = data.sound;
    if (data.ambient !== undefined) apiData.visAmbient = data.ambient;

    try {
      await this._api.updateSettings(apiData);
      this._save();
    } catch (err) {
      this._handleError('Не удалось обновить видимость настроек', err);
      throw err;
    }
  }

  // --- Экспорт/Импорт ---

  async exportJSON() {
    const data = await this._api.exportConfig();
    return JSON.stringify(data, null, 2);
  }

  async importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      await this._api.importConfig(parsed);
      this._books = await this._api.getBooks();
      if (this._books.length > 0) {
        this._activeBookId = this._books[0].id;
      }
      this._save();
    } catch (err) {
      this._handleError('Не удалось импортировать конфигурацию', err);
      throw err;
    }
  }

  /** Сбросить (удалить все книги) */
  async reset() {
    try {
      for (const book of this._books) {
        await this._api.deleteBook(book.id);
      }
      this._books = [];
      this._activeBookId = '';
      this._save();
    } catch (err) {
      this._handleError('Не удалось сбросить данные', err);
      throw err;
    }
  }

  /** Получить полный конфиг (для совместимости) */
  async getConfig() {
    return this._api.exportConfig();
  }

  /** Clear (для совместимости с AdminConfigStore) */
  async clear() {
    await this.reset();
  }
}
