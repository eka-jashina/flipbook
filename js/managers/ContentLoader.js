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
 */

import { CONFIG } from '../config.js';

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
   * Загрузить один URL с retry-логикой
   * @private
   * @param {string} url - URL для загрузки
   * @param {AbortSignal} signal - Сигнал отмены
   * @returns {Promise<string>} HTML-контент
   */
  async _fetchWithRetry(url, signal) {
    const { MAX_RETRIES, INITIAL_RETRY_DELAY } = CONFIG.NETWORK;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(url, { signal });

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
        // Не ретраим при отмене запроса
        if (error.name === "AbortError") {
          throw error;
        }

        lastError = error;

        // Последняя попытка — не ждём
        if (attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          await this._delay(delay, signal);
        }
      }
    }

    throw new Error(`Failed to load ${url} after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Загрузить контент глав
   * @param {Array<{file: string, htmlContent?: string}>} chapters - Главы (URL или inline-контент)
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
    const missing = items.filter(item => !item.htmlContent && !this.cache.has(item.file));

    if (missing.length) {
      await Promise.all(
        missing.map(async (item) => {
          const text = await this._fetchWithRetry(item.file, signal);
          this.cache.set(item.file, text);
        })
      );
    }

    // Возвращаем объединённый контент в порядке глав
    return items.map(item => this.cache.get(item._cacheKey)).join("\n");
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
