/**
 * CONTENT LOADER
 * Загрузка и кэширование HTML-контента глав.
 *
 * Особенности:
 * - Параллельная загрузка нескольких URL
 * - Кэширование загруженного контента
 * - Поддержка отмены через AbortController
 * - Автоматический пропуск уже закэшированных URL
 * - Фоновая предзагрузка через requestIdleCallback
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class ContentLoader extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, string>} Кэш URL → HTML */
    this.cache = new Map();
    /** @type {AbortController|null} Контроллер текущей загрузки */
    this.controller = null;
    /** @type {Set<string>} URL в процессе фоновой загрузки */
    this.pendingUrls = new Set();
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
      // Параллельная загрузка всех недостающих URL
      await Promise.all(
        missing.map(async (url) => {
          const resp = await fetch(url, { signal });
          if (!resp.ok) {
            throw new Error(`Failed to load ${url}: ${resp.status}`);
          }
          const text = await resp.text();
          this.cache.set(url, text);
        })
      );
    }

    // Возвращаем объединённый контент в порядке переданных URL
    return urls.map(u => this.cache.get(u)).join("\n");
  }

  /**
   * Проверить, загружены ли все URL
   * @param {string[]} urls - Массив URL для проверки
   * @returns {boolean}
   */
  hasAll(urls) {
    return urls.every(url => this.cache.has(url));
  }

  /**
   * Загрузить URL в фоновом режиме через requestIdleCallback
   * @param {string[]} urls - Массив URL для фоновой загрузки
   * @returns {Promise<void>} Резолвится когда все URL загружены
   */
  preloadInBackground(urls) {
    return new Promise((resolve) => {
      const missing = urls.filter(u => !this.cache.has(u) && !this.pendingUrls.has(u));

      if (missing.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const totalToLoad = missing.length;

      const loadUrl = async (url) => {
        if (this.cache.has(url)) {
          loadedCount++;
          if (loadedCount === totalToLoad) {
            this.emit('backgroundLoadComplete', urls);
            resolve();
          }
          return;
        }

        this.pendingUrls.add(url);

        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const text = await resp.text();
            this.cache.set(url, text);
            this.emit('chapterLoaded', { url, cached: this.cache.size });
          }
        } catch (error) {
          // Фоновая загрузка не должна прерывать работу приложения
          console.warn(`Background load failed for ${url}:`, error.message);
        } finally {
          this.pendingUrls.delete(url);
          loadedCount++;

          if (loadedCount === totalToLoad) {
            this.emit('backgroundLoadComplete', urls);
            resolve();
          }
        }
      };

      // Загружаем по одному в idle time
      const scheduleNext = (index) => {
        if (index >= missing.length) return;

        const doLoad = () => {
          loadUrl(missing[index]);
          scheduleNext(index + 1);
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(doLoad, { timeout: 2000 });
        } else {
          setTimeout(doLoad, 100);
        }
      };

      // Запускаем загрузку
      scheduleNext(0);
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
    this.pendingUrls.clear();
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    this.abort();
    this.clear();
    super.destroy();
  }
}
