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

/** @type {number} Максимальное количество попыток */
const MAX_RETRIES = 3;
/** @type {number} Начальная задержка перед retry (мс) */
const INITIAL_DELAY = 1000;

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
          const delay = INITIAL_DELAY * Math.pow(2, attempt);
          await this._delay(delay, signal);
        }
      }
    }

    throw new Error(`Failed to load ${url} after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Загрузить контент по списку URL
   * @param {string[]} urls - Массив URL для загрузки
   * @returns {Promise<string>} Объединённый HTML всех URL
   * @throws {Error} При ошибке загрузки
   */
  async load(urls) {
    // Отменяем предыдущую загрузку если была
    this.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    // Загружаем только те URL, которых нет в кэше
    const missing = urls.filter(u => !this.cache.has(u));

    if (missing.length) {
      // Параллельная загрузка всех недостающих URL с retry
      await Promise.all(
        missing.map(async (url) => {
          const text = await this._fetchWithRetry(url, signal);
          this.cache.set(url, text);
        })
      );
    }

    // Возвращаем объединённый контент в порядке переданных URL
    return urls.map(u => this.cache.get(u)).join("\n");
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
