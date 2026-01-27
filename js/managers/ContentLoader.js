/**
 * CONTENT LOADER
 * Загрузка и кэширование HTML-контента глав.
 *
 * Особенности:
 * - Параллельная загрузка нескольких URL
 * - Кэширование загруженного контента
 * - Поддержка отмены через AbortController
 * - Автоматический пропуск уже закэшированных URL
 */

export class ContentLoader {
  constructor() {
    /** @type {Map<string, string>} Кэш URL → HTML */
    this.cache = new Map();
    /** @type {AbortController|null} Контроллер текущей загрузки */
    this.controller = null;
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
