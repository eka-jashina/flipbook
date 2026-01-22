/**
 * BACKGROUND MANAGER
 * Управление фоновыми изображениями с кроссфейдом и предзагрузкой.
 */

export class BackgroundManager {
  constructor() {
    this.backgrounds = document.querySelectorAll(".chapter-bg .bg");
    this.currentBg = null;
    this.activeIndex = 0;
    this.preloadedUrls = new Set();
    this.preloadQueue = [];
  }

  /**
   * Установить фон
   * @param {string} url - URL изображения
   */
  setBackground(url) {
    if (this.currentBg === url) return;
    this.currentBg = url;

    const nextIndex = (this.activeIndex + 1) % this.backgrounds.length;
    const incoming = this.backgrounds[nextIndex];
    const outgoing = this.backgrounds[this.activeIndex];

    incoming.style.backgroundImage = `url(${url})`;
    incoming.dataset.active = "true";
    outgoing.dataset.active = "false";

    this.activeIndex = nextIndex;
  }

  /**
   * Предзагрузить изображение
   * @param {string} url - URL изображения
   * @param {boolean} highPriority - Высокий приоритет загрузки
   * @returns {Promise<void>}
   */
  async preload(url, highPriority = false) {
    if (!url || this.preloadedUrls.has(url)) {
      return Promise.resolve();
    }

    // Если уже в очереди - не добавляем повторно
    if (this.preloadQueue.some(item => item.url === url)) {
      return;
    }

    const preloadPromise = new Promise((resolve, reject) => {
      // Используем link rel="preload" для лучшей интеграции с браузером
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      
      if (highPriority) {
        link.fetchPriority = "high";
      }

      link.onload = () => {
        this.preloadedUrls.add(url);
        this._removeFromQueue(url);
        document.head.removeChild(link);
        resolve();
      };

      link.onerror = () => {
        console.warn(`Failed to preload image: ${url}`);
        this._removeFromQueue(url);
        document.head.removeChild(link);
        reject(new Error(`Failed to preload: ${url}`));
      };

      document.head.appendChild(link);
    });

    this.preloadQueue.push({ url, promise: preloadPromise });
    return preloadPromise.catch(() => {}); // Не прерываем выполнение при ошибке
  }

  /**
   * Предзагрузить несколько изображений
   * @param {string[]} urls - Массив URL
   * @param {boolean} highPriority - Высокий приоритет
   * @returns {Promise<void[]>}
   */
  async preloadMultiple(urls, highPriority = false) {
    return Promise.all(
      urls.map(url => this.preload(url, highPriority))
    );
  }

  /**
   * Проверить, загружен ли фон
   * @param {string} url
   * @returns {boolean}
   */
  isPreloaded(url) {
    return this.preloadedUrls.has(url);
  }

  /**
   * Очистить кэш предзагрузки
   */
  clearPreloadCache() {
    this.preloadedUrls.clear();
  }

  /**
   * Удалить из очереди загрузки
   * @private
   */
  _removeFromQueue(url) {
    const index = this.preloadQueue.findIndex(item => item.url === url);
    if (index !== -1) {
      this.preloadQueue.splice(index, 1);
    }
  }

  destroy() {
    this.backgrounds = null;
    this.currentBg = null;
    this.preloadedUrls.clear();
    this.preloadQueue = [];
  }
}