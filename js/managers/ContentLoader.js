/**
 * CONTENT LOADER
 * Загрузка и кэширование HTML-контента глав.
 */

export class ContentLoader {
  constructor() {
    this.cache = new Map();
    this.controller = null;
  }

  async load(urls) {
    this.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    const missing = urls.filter(u => !this.cache.has(u));

    if (missing.length) {
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

    return urls.map(u => this.cache.get(u)).join("\n");
  }

  abort() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    this.abort();
    this.clear();
  }
}
