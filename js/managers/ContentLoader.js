/**
 * CONTENT LOADER
 * Загрузка и кэширование HTML-контента глав.
 *
 * Особенности:
 * - Параллельная загрузка нескольких URL
 * - Кэширование загруженного контента
 * - Поддержка отмены через AbortController
 * - Автоматический пропуск уже закэшированных URL
 * - Retry с exponential backoff при сетевых ошибках
 * - Загрузка inline-контента из IndexedDB (для книг, загруженных из EPUB/FB2)
 */

import { CONFIG } from '../config.js';

const IDB_NAME = 'flipbook-admin';
const IDB_STORE = 'config';
const IDB_VERSION = 1;
const ADMIN_CONFIG_KEY = 'flipbook-admin-config';

export class ContentLoader {
  constructor() {
    /** @type {Map<string, string>} Кэш URL → HTML */
    this.cache = new Map();
    /** @type {AbortController|null} Контроллер текущей загрузки */
    this.controller = null;
  }

  /**
   * Задержка выполнения
   * @private
   * @param {number} ms - Время в миллисекундах
   * @param {AbortSignal} signal - Сигнал отмены
   * @returns {Promise<void>}
   */
  _delay(ms, signal) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }

  /**
   * Загрузить один URL с retry-логикой и таймаутом
   * @private
   * @param {string} url - URL для загрузки
   * @param {AbortSignal} signal - Сигнал отмены
   * @returns {Promise<string>} HTML-контент
   */
  async _fetchWithRetry(url, signal) {
    const { MAX_RETRIES, INITIAL_RETRY_DELAY, FETCH_TIMEOUT } = CONFIG.NETWORK;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Таймаут для каждой попытки отдельно
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT);

      // Пробрасываем внешний abort на timeout controller
      const onExternalAbort = () => timeoutController.abort();
      signal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const resp = await fetch(url, { signal: timeoutController.signal });

        if (!resp.ok) {
          // HTTP ошибки (4xx, 5xx) — не ретраим клиентские ошибки
          if (resp.status >= 400 && resp.status < 500) {
            throw new Error(`Failed to load ${url}: ${resp.status}`);
          }
          // Серверные ошибки — ретраим
          throw new Error(`Server error ${resp.status}`);
        }

        return await resp.text();
      } catch (error) {
        // Не ретраим при внешней отмене запроса
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Таймаут — ретраим с понятным сообщением
        if (error.name === "AbortError") {
          lastError = new Error(`Request timeout for ${url} after ${FETCH_TIMEOUT}ms`);
        } else {
          lastError = error;
        }

        // Последняя попытка — не ждём
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await this._delay(delay, signal);
        }
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onExternalAbort);
      }
    }

    throw new Error(`Failed to load ${url} after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Загрузить контент глав
   * @param {Array<{file: string, htmlContent?: string, _idb?: boolean}>} chapters - Главы (URL, inline-контент или IDB)
   * @returns {Promise<string>} Объединённый HTML всех глав
   * @throws {Error} При ошибке загрузки
   */
  async load(chapters) {
    // Обратная совместимость: если передан массив строк (URL) — обернуть
    const items = chapters.map(ch =>
      typeof ch === 'string' ? { file: ch } : ch
    );

    // Отменяем предыдущую загрузку если была
    this.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    // Загружаем контент из IndexedDB для глав с маркером _idb
    const idbItems = items.filter(item => item._idb && !item.htmlContent);
    if (idbItems.length > 0) {
      await this._loadChaptersFromIDB(idbItems);
    }

    // Кэшируем inline-контент и определяем что нужно загружать
    for (const item of items) {
      if (item.htmlContent) {
        // Inline-контент — сразу в кэш по ключу
        const key = item.file || `__inline_${item.id || ''}`;
        item._cacheKey = key;
        this.cache.set(key, item.htmlContent);
      } else {
        item._cacheKey = item.file;
      }
    }

    // Загружаем только URL, которых нет в кэше
    const missing = items.filter(item => !item.htmlContent && item.file && !this.cache.has(item.file));

    if (missing.length) {
      await Promise.all(
        missing.map(async (item) => {
          const text = await this._fetchWithRetry(item.file, signal);
          this.cache.set(item.file, text);
        })
      );
    }

    // Возвращаем объединённый контент в порядке глав
    return items.map(item => this.cache.get(item._cacheKey)).filter(Boolean).join("\n");
  }

  /**
   * Загрузить htmlContent глав из IndexedDB (админ-конфиг)
   * Используется когда localStorage содержит только метаданные (htmlContent убран для экономии места)
   * @private
   * @param {Array} items - Главы, которым нужно подгрузить htmlContent
   */
  async _loadChaptersFromIDB(items) {
    try {
      const config = await this._readAdminConfigFromIDB();
      if (!config) return;

      const book = config.books?.find(b => b.id === config.activeBookId) || config.books?.[0];
      if (!book?.chapters) return;

      // Сопоставляем главы по id
      const chapterMap = new Map();
      for (const ch of book.chapters) {
        if (ch.id && ch.htmlContent) {
          chapterMap.set(ch.id, ch.htmlContent);
        }
      }

      for (const item of items) {
        const content = chapterMap.get(item.id);
        if (content) {
          item.htmlContent = content;
        }
      }
    } catch (err) {
      console.warn('ContentLoader: не удалось загрузить контент из IndexedDB', err);
    }
  }

  /**
   * Прочитать админ-конфиг из IndexedDB
   * @private
   * @returns {Promise<Object|null>}
   */
  async _readAdminConfigFromIDB() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const getReq = store.get(ADMIN_CONFIG_KEY);

            getReq.onsuccess = () => {
              db.close();
              resolve(getReq.result ?? null);
            };
            getReq.onerror = () => {
              db.close();
              resolve(null);
            };
          } catch {
            db.close();
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Отменить текущую загрузку
   */
  abort() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * Очистить кэш загруженного контента
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    this.abort();
    this.clear();
  }
}
