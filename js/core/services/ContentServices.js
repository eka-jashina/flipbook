/**
 * CONTENT SERVICES
 * Группирует компоненты для работы с контентом.
 *
 * Содержит:
 * - ContentLoader - загрузка HTML контента глав
 * - BackgroundManager - управление фоновыми изображениями
 */

import { ContentLoader, BackgroundManager } from '../../managers/index.js';

export class ContentServices {
  constructor() {
    this.contentLoader = new ContentLoader();
    this.backgroundManager = new BackgroundManager();
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.contentLoader?.destroy?.();
    this.backgroundManager?.destroy?.();

    this.contentLoader = null;
    this.backgroundManager = null;
  }
}
