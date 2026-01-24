/**
 * RESIZE HANDLER
 * Обработка изменения размера окна с дебаунсингом.
 * 
 * При изменении размера окна:
 * 1. Инвалидирует кэш CSS переменных
 * 2. Запускает репагинацию (если книга открыта)
 */

import { cssVars } from '../utils/CSSVariables.js';

export class ResizeHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.eventManager = context.eventManager;
    this.timerManager = context.timerManager;
    this.repaginateFn = context.repaginateFn;
    this.isOpenedFn = context.isOpenedFn;
    this.isDestroyedFn = context.isDestroyedFn;
    
    this.resizeTimer = null;
    this.debounceDelay = cssVars.getTime("--timing-resize-debounce", 150);
  }

  /**
   * Привязать обработчик resize
   */
  bind() {
    this.eventManager.add(window, "resize", () => this._handleResize());
  }

  /**
   * Обработать resize с дебаунсингом
   * @private
   */
  _handleResize() {
    if (this.resizeTimer) {
      this.timerManager.clearTimeout(this.resizeTimer);
    }
    
    this.resizeTimer = this.timerManager.setTimeout(() => {
      if (this.isOpenedFn() && !this.isDestroyedFn()) {
        cssVars.invalidateCache();
        this.repaginateFn(true);
      }
    }, this.debounceDelay);
  }

  /**
   * Очистить таймер
   */
  destroy() {
    if (this.resizeTimer) {
      this.timerManager.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }
}
