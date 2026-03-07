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

/** HTTP-методы, требующие CSRF-токен */
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiClient {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onUnauthorized] - Колбэк при 401 (показ экрана логина)
   */
  constructor({ onUnauthorized } = {}) {
    this._onUnauthorized = onUnauthorized || null;
    /** @type {string|null} CSRF-токен (lazy-загрузка при первом мутирующем запросе) */
    this._csrfToken = null;
    /** @type {Promise<string>|null} Промис текущего запроса токена (дедупликация) */
    this._csrfPromise = null;
  }

  // ═══════════════════════════════════════════
  // CSRF
  // ═══════════════════════════════════════════

  /**
   * Получить CSRF-токен (lazy, с дедупликацией параллельных вызовов)
   * @returns {Promise<string>}
   */
  async _ensureCsrfToken() {
    if (this._csrfToken) return this._csrfToken;

    if (!this._csrfPromise) {
      this._csrfPromise = (async () => {
        try {
          const res = await fetch('/api/v1/auth/csrf-token', { credentials: 'include' });
          if (!res.ok) throw new ApiError(res.status, 'Не удалось получить CSRF-токен');
          const json = await res.json();
          this._csrfToken = json.data?.token || json.token;
          return this._csrfToken;
        } finally {
          this._csrfPromise = null;
        }
      })();
    }

    return this._csrfPromise;
  }

  // ═══════════════════════════════════════════
  // Базовый fetch
  // ═══════════════════════════════════════════

  /**
   * Выполнить HTTP-запрос к API
   * @param {string} path - Путь (например '/api/v1/books')
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

    // Добавить CSRF-токен для мутирующих запросов
    const method = (rest.method || 'GET').toUpperCase();
    if (CSRF_METHODS.has(method)) {
      const token = await this._ensureCsrfToken();
      if (token) headers['x-csrf-token'] = token;
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

    // 403 + CSRF — токен мог протухнуть, сбрасываем для повторного получения
    if (response.status === 403 && CSRF_METHODS.has(method)) {
      this._csrfToken = null;
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

    // Unwrap standard { data } envelope from API responses
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data;
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
      const data = await this._fetch('/api/v1/auth/me');
      return data.user;
    } catch (err) {
      if (err.status === 401) return null;
      throw err;
    }
  }

  /** Регистрация + автоматический вход */
  async register(email, password, displayName, username) {
    const data = await this._fetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, displayName, username },
    });
    return data.user;
  }

  /** Вход */
  async login(email, password) {
    const data = await this._fetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    return data.user;
  }

  /** Выход */
  async logout() {
    await this._fetch('/api/v1/auth/logout', { method: 'POST' });
    this._csrfToken = null;
  }

  // ═══════════════════════════════════════════
  // Книги
  // ═══════════════════════════════════════════

  /** Список книг (для полки) */
  async getBooks() {
    return this._fetchWithRetry('/api/v1/books');
  }

  /** Создать книгу */
  async createBook(data) {
    return this._fetchWithRetry('/api/v1/books', { method: 'POST', body: data });
  }

  /** Полная информация о книге */
  async getBook(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`);
  }

  /** Обновить метаданные книги */
  async updateBook(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`, { method: 'PATCH', body: data });
  }

  /** Удалить книгу */
  async deleteBook(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}`, { method: 'DELETE' });
  }

  /** Изменить порядок книг */
  async reorderBooks(bookIds) {
    return this._fetchWithRetry('/api/v1/books/reorder', { method: 'PATCH', body: { bookIds } });
  }

  // ═══════════════════════════════════════════
  // Главы
  // ═══════════════════════════════════════════

  /** Список глав (мета, без контента) */
  async getChapters(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters`);
  }

  /** Добавить главу */
  async createChapter(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters`, { method: 'POST', body: data });
  }

  /** Глава с метаданными */
  async getChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`);
  }

  /** Обновить главу */
  async updateChapter(bookId, chapterId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`, { method: 'PATCH', body: data });
  }

  /** Удалить главу */
  async deleteChapter(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}`, { method: 'DELETE' });
  }

  /** Изменить порядок глав */
  async reorderChapters(bookId, chapterIds) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/reorder`, { method: 'PATCH', body: { chapterIds } });
  }

  /** HTML-контент главы */
  async getChapterContent(bookId, chapterId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/chapters/${chapterId}/content`);
  }

  // ═══════════════════════════════════════════
  // Внешний вид (Appearance)
  // ═══════════════════════════════════════════

  /** Настройки внешнего вида */
  async getAppearance(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance`);
  }

  /** Обновить общие настройки (fontMin, fontMax) */
  async updateAppearance(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance`, { method: 'PATCH', body: data });
  }

  /** Обновить тему (light/dark) */
  async updateAppearanceTheme(bookId, theme, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/appearance/${theme}`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Звуки
  // ═══════════════════════════════════════════

  /** Звуки книги */
  async getSounds(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/sounds`);
  }

  /** Обновить звуки */
  async updateSounds(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/sounds`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Эмбиенты
  // ═══════════════════════════════════════════

  /** Список эмбиентов */
  async getAmbients(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients`);
  }

  /** Добавить эмбиент */
  async createAmbient(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients`, { method: 'POST', body: data });
  }

  /** Обновить эмбиент */
  async updateAmbient(bookId, ambientId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/${ambientId}`, { method: 'PATCH', body: data });
  }

  /** Удалить эмбиент */
  async deleteAmbient(bookId, ambientId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/${ambientId}`, { method: 'DELETE' });
  }

  /** Изменить порядок эмбиентов */
  async reorderAmbients(bookId, ambientIds) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/ambients/reorder`, { method: 'PATCH', body: { ambientIds } });
  }

  // ═══════════════════════════════════════════
  // Декоративный шрифт (per-book)
  // ═══════════════════════════════════════════

  /** Получить декоративный шрифт */
  async getDecorativeFont(bookId) {
    try {
      return await this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /** Установить декоративный шрифт (upsert) */
  async setDecorativeFont(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`, { method: 'PUT', body: data });
  }

  /** Удалить декоративный шрифт */
  async deleteDecorativeFont(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/decorative-font`, { method: 'DELETE' });
  }

  // ═══════════════════════════════════════════
  // Шрифты для чтения (global)
  // ═══════════════════════════════════════════

  /** Список шрифтов */
  async getFonts() {
    return this._fetchWithRetry('/api/v1/fonts');
  }

  /** Добавить шрифт */
  async createFont(data) {
    return this._fetchWithRetry('/api/v1/fonts', { method: 'POST', body: data });
  }

  /** Обновить шрифт */
  async updateFont(fontId, data) {
    return this._fetchWithRetry(`/api/v1/fonts/${fontId}`, { method: 'PATCH', body: data });
  }

  /** Удалить шрифт */
  async deleteFont(fontId) {
    return this._fetchWithRetry(`/api/v1/fonts/${fontId}`, { method: 'DELETE' });
  }

  /** Изменить порядок шрифтов */
  async reorderFonts(fontIds) {
    return this._fetchWithRetry('/api/v1/fonts/reorder', { method: 'PATCH', body: { fontIds } });
  }

  // ═══════════════════════════════════════════
  // Настройки
  // ═══════════════════════════════════════════

  /** Глобальные настройки */
  async getSettings() {
    return this._fetchWithRetry('/api/v1/settings');
  }

  /** Обновить глобальные настройки */
  async updateSettings(data) {
    return this._fetchWithRetry('/api/v1/settings', { method: 'PATCH', body: data });
  }

  /** Дефолтные настройки книги */
  async getDefaultSettings(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/default-settings`);
  }

  /** Обновить дефолтные настройки книги */
  async updateDefaultSettings(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/default-settings`, { method: 'PATCH', body: data });
  }

  // ═══════════════════════════════════════════
  // Прогресс чтения
  // ═══════════════════════════════════════════

  /** Получить прогресс чтения */
  async getProgress(bookId) {
    try {
      return await this._fetchWithRetry(`/api/v1/books/${bookId}/progress`);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /** Сохранить прогресс чтения (upsert) */
  async saveProgress(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/progress`, { method: 'PUT', body: data });
  }

  /** Сохранить сессию чтения */
  async saveReadingSession(bookId, data) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions`, { method: 'POST', body: data });
  }

  /** Получить историю сессий чтения */
  async getReadingSessions(bookId, { limit = 50, offset = 0 } = {}) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions?limit=${limit}&offset=${offset}`);
  }

  /** Получить статистику чтения по книге */
  async getReadingStats(bookId) {
    return this._fetchWithRetry(`/api/v1/books/${bookId}/reading-sessions/stats`);
  }

  // ═══════════════════════════════════════════
  // Загрузка файлов
  // ═══════════════════════════════════════════

  /** Загрузить шрифт */
  async uploadFont(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/font', { method: 'POST', body: form });
  }

  /** Загрузить звук */
  async uploadSound(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/sound', { method: 'POST', body: form });
  }

  /** Загрузить изображение */
  async uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/image', { method: 'POST', body: form });
  }

  /** Загрузить книгу (парсинг на сервере) */
  async uploadBook(file) {
    const form = new FormData();
    form.append('file', file);
    return this._fetchWithRetry('/api/v1/upload/book', { method: 'POST', body: form });
  }

  // ═══════════════════════════════════════════
  // Экспорт/Импорт
  // ═══════════════════════════════════════════

  /** Экспорт всей конфигурации */
  async exportConfig() {
    return this._fetchWithRetry('/api/v1/export');
  }

  /** Импорт конфигурации */
  async importConfig(data) {
    return this._fetchWithRetry('/api/v1/import', { method: 'POST', body: data });
  }

  // ═══════════════════════════════════════════
  // Health
  // ═══════════════════════════════════════════

  /** Проверка здоровья сервера */
  async health() {
    return this._fetch('/api/health');
  }

  // ═══════════════════════════════════════════
  // Публичное API (без авторизации)
  // ═══════════════════════════════════════════

  /** Публичная полка автора */
  async getPublicShelf(username) {
    return this._fetchWithRetry(`/api/v1/public/shelves/${encodeURIComponent(username)}`);
  }

  /** Витрина публичных книг */
  async getPublicDiscover(limit = 6) {
    return this._fetchWithRetry(`/api/v1/public/discover?limit=${limit}`);
  }

  /** Публичная книга (детали для чтения) */
  async getPublicBook(bookId) {
    return this._fetchWithRetry(`/api/v1/public/books/${encodeURIComponent(bookId)}`);
  }

  /** Контент главы публичной книги */
  async getPublicChapterContent(bookId, chapterId) {
    return this._fetchWithRetry(
      `/api/v1/public/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}/content`
    );
  }

  // ═══════════════════════════════════════════
  // Профиль
  // ═══════════════════════════════════════════

  /** Получить профиль текущего пользователя */
  async getProfile() {
    return this._fetchWithRetry('/api/v1/profile');
  }

  /** Обновить профиль текущего пользователя */
  async updateProfile(data) {
    return this._fetchWithRetry('/api/v1/profile', { method: 'PUT', body: data });
  }

  /** Проверить доступность username */
  async checkUsername(username) {
    return this._fetchWithRetry(`/api/v1/profile/check-username/${encodeURIComponent(username)}`);
  }
}
