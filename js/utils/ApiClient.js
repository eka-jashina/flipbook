/**
 * API CLIENT
 *
 * Единый класс для взаимодействия с серверным API.
 * Все HTTP-запросы идут через базовый _fetch() с:
 * - credentials: 'include' (серверные сессии через cookie)
 * - Обработка 401 → колбэк _onUnauthorized (показ модалки логина)
 * - Структурированные ошибки (ApiError)
 *
 * ~30-40 методов для 12 ресурсов — нормальный размер для одного класса.
 * Разбивка на отдельные модули — преждевременная декомпозиция (ADR Фаза 3).
 */

export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} message - Сообщение об ошибке
   * @param {Object} [details] - Дополнительные детали (Zod-ошибки и т.д.)
   */
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Настройки retry по умолчанию */
const RETRY_DEFAULTS = { maxRetries: 2, initialDelay: 1000 };

export class ApiClient {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onUnauthorized] - Колбэк при 401 (показ экрана логина)
   */
  constructor({ onUnauthorized } = {}) {
    this._onUnauthorized = onUnauthorized || null;
  }

  // ═══════════════════════════════════════════
  // Базовый fetch
  // ═══════════════════════════════════════════

  /**
   * Выполнить HTTP-запрос к API
   * @param {string} path - Путь (например '/api/books')
   * @param {Object} [options] - fetch options
   * @returns {Promise<*>} Parsed JSON response
   * @throws {ApiError}
   */
  async _fetch(path, options = {}) {
    const { headers: extraHeaders, body, ...rest } = options;

    const headers = { ...extraHeaders };
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(path, {
        ...rest,
        headers,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        credentials: 'include',
      });
    } catch (err) {
      throw new ApiError(0, `Нет соединения с сервером: ${err.message}`);
    }

    // 401 — не авторизован
    if (response.status === 401) {
      if (this._onUnauthorized) {
        this._onUnauthorized();
      }
      throw new ApiError(401, 'Необходима авторизация');
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Попытаться распарсить JSON
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Для content endpoint — возвращаем текст
      data = await response.text();
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Ошибка сервера: ${response.status}`;
      throw new ApiError(response.status, message, data?.details);
    }

    return data;
  }

  /**
   * Задержка выполнения
   * @private
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
  }

  /**
   * Fetch с автоматическим retry для 5xx и network-ошибок.
   * Не ретраит 4xx (клиентские ошибки) и 401 (авторизация).
   * @param {string} path
   * @param {Object} [options] - fetch options
   * @param {Object} [retryOpts] - { maxRetries, initialDelay }
   * @returns {Promise<*>}
   * @throws {ApiError}
   */
  async _fetchWithRetry(path, options = {}, retryOpts = {}) {
    const { maxRetries, initialDelay } = { ...RETRY_DEFAULTS, ...retryOpts };
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._fetch(path, options);
      } catch (err) {
        lastError = err;

        // Не ретраим клиентские ошибки (4xx) — они не исправятся повтором
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }

        // Последняя попытка — не ждём, бросаем
        if (attempt >= maxRetries) break;

        const delay = initialDelay * Math.pow(2, attempt);
        await this._delay(delay);
      }
    }

    throw lastError;
  }

  // ═══════════════════════════════════════════
  // Аутентификация
  // ═══════════════════════════════════════════

  /** Получить текущего пользователя (или null если не авторизован) */
  async getMe() {
    try {
      const data = await this._fetch('/api/auth/me');
      return data.user;
    } catch (err) {
      if (err.status === 401) return null;
      throw err;
    }
  }

  /** Регистрация + автоматический вход */
  async register(email, password, displayName) {
    const data = await this._fetch('/api/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    });
    return data.user;
  }

  /** Вход */
  async login(email, password) {
    const data = await this._fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    return data.user;
  }

  /** Выход */
  async logout() {
    await this._fetch('/api/auth/logout', { method: 'POST' });
  }

  // ═══════════════════════════════════════════
  // Книги
  // ═══════════════════════════════════════════

  /** Список книг (для полки) */
  async getBooks() {
    return this._fetchWithRetry('/api/books');
  }

  /** Создать книгу */
  async createBook(data) {
    return this._fetchWithRetry('/api/books', { method: 'POST', body: data });
  }

  /** Полная информация о книге */
  async getBook(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}`);
  }

  /** Обновить метаданные книги */
  async updateBook(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}`, { method: 'PATCH', body: data });
  }

  /** Удалить книгу */
  async deleteBook(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}`, { method: 'DELETE' });
  }

  /** Изменить порядок книг */
  async reorderBooks(bookIds) {
    return this._fetchWithRetry('/api/books/reorder', { method: 'PATCH', body: { bookIds } });
  }

  // ═══════════════════════════════════════════
  // Главы
  // ═══════════════════════════════════════════

  /** Список глав (мета, без контента) */
  async getChapters(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters`);
  }

  /** Добавить главу */
  async createChapter(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters`, { method: 'POST', body: data });
  }

  /** Глава с метаданными */
  async getChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters/${chapterId}`);
  }

  /** Обновить главу */
  async updateChapter(bookId, chapterId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters/${chapterId}`, { method: 'PATCH', body: data });
  }

  /** Удалить главу */
  async deleteChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' });
  }

  /** Изменить порядок глав */
  async reorderChapters(bookId, chapterIds) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters/reorder`, { method: 'PATCH', body: { chapterIds } });
  }

  /** HTML-контент главы */
  async getChapterContent(bookId, chapterId) {
    return this._fetchWithRetry(`/api/books/${bookId}/chapters/${chapterId}/content`);
  }

  // ═══════════════════════════════════════════
  // Внешний вид (Appearance)
  // ═══════════════════════════════════════════

  /** Настройки внешнего вида */
  async getAppearance(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/appearance`);
  }

  /** Обновить общие настройки (fontMin, fontMax) */
  async updateAppearance(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/appearance`, { method: 'PATCH', body: data });
  }

  /** Обновить тему (light/dark) */
  async updateAppearanceTheme(bookId, theme, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/appearance/${theme}`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Звуки
  // ═══════════════════════════════════════════

  /** Звуки книги */
  async getSounds(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/sounds`);
  }

  /** Обновить звуки */
  async updateSounds(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/sounds`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Эмбиенты
  // ═══════════════════════════════════════════

  /** Список эмбиентов */
  async getAmbients(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/ambients`);
  }

  /** Добавить эмбиент */
  async createAmbient(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/ambients`, { method: 'POST', body: data });
  }

  /** Обновить эмбиент */
  async updateAmbient(bookId, ambientId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/ambients/${ambientId}`, { method: 'PATCH', body: data });
  }

  /** Удалить эмбиент */
  async deleteAmbient(bookId, ambientId) {
    return this._fetchWithRetry(`/api/books/${bookId}/ambients/${ambientId}`, { method: 'DELETE' });
  }

  /** Изменить порядок эмбиентов */
  async reorderAmbients(bookId, ambientIds) {
    return this._fetchWithRetry(`/api/books/${bookId}/ambients/reorder`, { method: 'PATCH', body: { ambientIds } });
  }

  // ═══════════════════════════════════════════
  // Декоративный шрифт (per-book)
  // ═══════════════════════════════════════════

  /** Получить декоративный шрифт */
  async getDecorativeFont(bookId) {
    try {
      return await this._fetchWithRetry(`/api/books/${bookId}/decorative-font`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /** Установить декоративный шрифт (upsert) */
  async setDecorativeFont(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/decorative-font`, { method: 'PUT', body: data });
  }

  /** Удалить декоративный шрифт */
  async deleteDecorativeFont(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/decorative-font`, { method: 'DELETE' });
  }

  // ═══════════════════════════════════════════
  // Шрифты для чтения (global)
  // ═══════════════════════════════════════════

  /** Список шрифтов */
  async getFonts() {
    return this._fetchWithRetry('/api/fonts');
  }

  /** Добавить шрифт */
  async createFont(data) {
    return this._fetchWithRetry('/api/fonts', { method: 'POST', body: data });
  }

  /** Обновить шрифт */
  async updateFont(fontId, data) {
    return this._fetchWithRetry(`/api/fonts/${fontId}`, { method: 'PATCH', body: data });
  }

  /** Удалить шрифт */
  async deleteFont(fontId) {
    return this._fetchWithRetry(`/api/fonts/${fontId}`, { method: 'DELETE' });
  }

  /** Изменить порядок шрифтов */
  async reorderFonts(fontIds) {
    return this._fetchWithRetry('/api/fonts/reorder', { method: 'PATCH', body: { fontIds } });
  }

  // ═══════════════════════════════════════════
  // Настройки
  // ═══════════════════════════════════════════

  /** Глобальные настройки */
  async getSettings() {
    return this._fetchWithRetry('/api/settings');
  }

  /** Обновить глобальные настройки */
  async updateSettings(data) {
    return this._fetchWithRetry('/api/settings', { method: 'PATCH', body: data });
  }

  /** Дефолтные настройки книги */
  async getDefaultSettings(bookId) {
    return this._fetchWithRetry(`/api/books/${bookId}/default-settings`);
  }

  /** Обновить дефолтные настройки книги */
  async updateDefaultSettings(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/default-settings`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Прогресс чтения
  // ═══════════════════════════════════════════

  /** Получить прогресс чтения */
  async getProgress(bookId) {
    try {
      return await this._fetchWithRetry(`/api/books/${bookId}/progress`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /** Сохранить прогресс чтения (upsert) */
  async saveProgress(bookId, data) {
    return this._fetchWithRetry(`/api/books/${bookId}/progress`, { method: 'PUT', body: data });
  }

  // ═══════════════════════════════════════════
  // Загрузка файлов
  // ═══════════════════════════════════════════

  /** Загрузить шрифт */
  async uploadFont(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/upload/font', { method: 'POST', body: form });
  }

  /** Загрузить звук */
  async uploadSound(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/upload/sound', { method: 'POST', body: form });
  }

  /** Загрузить изображение */
  async uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/upload/image', { method: 'POST', body: form });
  }

  /** Загрузить книгу (парсинг на сервере) */
  async uploadBook(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/upload/book', { method: 'POST', body: form });
  }

  // ═══════════════════════════════════════════
  // Экспорт/Импорт
  // ═══════════════════════════════════════════

  /** Экспорт всей конфигурации */
  async exportConfig() {
    return this._fetchWithRetry('/api/export');
  }

  /** Импорт конфигурации */
  async importConfig(data) {
    return this._fetchWithRetry('/api/import', { method: 'POST', body: data });
  }

  // ═══════════════════════════════════════════
  // Health
  // ═══════════════════════════════════════════

  /** Проверка здоровья сервера */
  async health() {
    return this._fetch('/api/health');
  }
}
