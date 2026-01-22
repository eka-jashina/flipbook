/**
 * Делегат жизненного цикла книги.
 * Открытие, закрытие, пагинация.
 */

import { CONFIG, BookState } from '../../config.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';

export class LifecycleDelegate {
  constructor(controller) {
    this.ctrl = controller;
  }

  get state() { return this.ctrl.stateMachine; }
  get isMobile() { return this.ctrl.isMobile; }

  /**
   * Открыть книгу
   * @param {number} startIndex
   */
  async open(startIndex = 0) {
    if (this.state.isBusy || !this.state.isClosed || this.ctrl.isDestroyed) {
      return;
    }

    if (!this.state.transitionTo(BookState.OPENING)) return;

    try {
      this.ctrl.loadingIndicator.show();

      const urls = CONFIG.CHAPTERS.map(c => c.file);
      const [signal, html] = await Promise.all([
        this.ctrl.animator.runOpenAnimation(),
        this.ctrl.contentLoader.load(urls),
      ]);

      if (!signal || !html || this.ctrl.isDestroyed) return;

      // Ждём стабилизации layout
      await this._waitForLayout();

      const { pages, chapterStarts } = await this.ctrl.paginator.paginate(
        html,
        this.ctrl.elements.rightA
      );

      this.ctrl.renderer.setPageContents(pages);
      this.ctrl.chapterStarts = chapterStarts;

      const maxIndex = this.ctrl.renderer.getMaxIndex(this.isMobile);
      this.ctrl.index = Math.max(0, Math.min(startIndex, maxIndex));
      this.ctrl.renderer.renderSpread(this.ctrl.index, this.isMobile);
      this.ctrl.chapterDelegate.updateChapterUI();

      await this.ctrl.animator.finishOpenAnimation(signal);

      this.state.transitionTo(BookState.OPENED);
      this.ctrl._updateDebug();
    } catch (error) {
      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при открытии книги");
      }
      this.state.reset(BookState.CLOSED);
    } finally {
      this.ctrl.loadingIndicator.hide();
    }
  }

  /**
   * Закрыть книгу
   */
  async close() {
    if (this.state.isBusy || !this.state.isOpened || this.ctrl.isDestroyed) {
      return;
    }

    if (!this.state.transitionTo(BookState.CLOSING)) return;

    const { leftA, rightA } = this.ctrl.elements;
    
    leftA.style.visibility = "hidden";
    rightA.style.visibility = "hidden";

    try {
      await this.ctrl.animator.runCloseAnimation();

      leftA.innerHTML = "";
      rightA.innerHTML = "";
      leftA.style.visibility = "";
      rightA.style.visibility = "";

      this.ctrl.index = 0;
      this.ctrl.settings.set("page", 0);
      this.ctrl.renderer.clearCache();

      this.state.transitionTo(BookState.CLOSED);
      this.ctrl._updateDebug();
    } catch (error) {
      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при закрытии книги");
      }
      this.state.reset(BookState.OPENED);
    }
  }

  /**
   * Репагинация (при изменении шрифта/размера/ориентации)
   * @param {boolean} keepIndex
   */
  async repaginate(keepIndex = false) {
    if (this.ctrl.isDestroyed) return;

    try {
      this.ctrl.loadingIndicator.show();
      this.ctrl.renderer.clearCache();

      const prevIndex = keepIndex ? this.ctrl.index : 0;
      
      const urls = CONFIG.CHAPTERS.map(c => c.file);
      const html = await this.ctrl.contentLoader.load(urls);

      if (!html || this.ctrl.isDestroyed) {
        this.ctrl.loadingIndicator.hide();
        return;
      }

      const { pages, chapterStarts } = await this.ctrl.paginator.paginate(
        html,
        this.ctrl.elements.rightA
      );

      this.ctrl.renderer.setPageContents(pages);
      this.ctrl.chapterStarts = chapterStarts;

      const maxIndex = this.ctrl.renderer.getMaxIndex(this.isMobile);
      this.ctrl.index = Math.min(prevIndex, maxIndex);

      this.ctrl.renderer.renderSpread(this.ctrl.index, this.isMobile);
      this.ctrl.chapterDelegate.updateChapterUI();
      this.ctrl._updateDebug();

      this.ctrl.loadingIndicator.hide();
    } catch (error) {
      this.ctrl.loadingIndicator.hide();
      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при обновлении страниц");
      }
    }
  }

  /**
   * Ожидание стабилизации layout
   * @private
   */
  async _waitForLayout() {
    const pageWidth = this.ctrl.elements.rightA.clientWidth;
    const bookWidth = this.ctrl.elements.book.clientWidth;
    
    if (!this.isMobile && pageWidth < bookWidth * CONFIG.LAYOUT.MIN_PAGE_WIDTH_RATIO) {
      await new Promise(r => setTimeout(r, CONFIG.LAYOUT.SETTLE_DELAY));
    }
  }
}