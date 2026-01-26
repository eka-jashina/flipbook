/**
 * NAVIGATION DELEGATE
 * Управление навигацией по книге.
 * 
 * Обрабатывает переходы между страницами и главами.
 * Обновлено для работы с DOMManager и звуком.
 */

import { CONFIG, BookState } from '../../config.js';

export class NavigationDelegate {
  /** @param {BookController} controller */
  constructor(controller) {
    this.ctrl = controller;
  }

  // Короткие алиасы для частых обращений
  get state() { return this.ctrl.stateMachine; }
  get renderer() { return this.ctrl.renderer; }
  get animator() { return this.ctrl.animator; }
  get settings() { return this.ctrl.settings; }
  get soundManager() { return this.ctrl.soundManager; }
  get isMobile() { return this.ctrl.isMobile; }

  /**
   * Навигация по оглавлению
   * @param {number|undefined} chapter
   */
  handleTOCNavigation(chapter) {
    if (!this.state.isOpened) {
      this.ctrl.flip("next");
      return;
    }

    if (chapter === undefined) {
      this.flipToPage(0, "prev");
      return;
    }

    if (chapter === -1) {
      this.flipToPage(this.renderer.getMaxIndex(this.isMobile), "next");
      return;
    }

    const page = this.ctrl.chapterStarts[chapter];
    if (page == null) return;

    const target = this.isMobile ? page : page - (page % 2);
    this.flipToPage(target, target > this.ctrl.index ? "next" : "prev");
  }

  /**
   * Переход на конкретную страницу
   * @param {number} targetIndex
   * @param {'next'|'prev'} direction
   */
  async flipToPage(targetIndex, direction) {
    if (this.state.isBusy || !this.state.isOpened || this.ctrl.isDestroyed) {
      return;
    }

    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));

    if (this.ctrl.index === targetIndex) return;

    if (!this.state.transitionTo(BookState.FLIPPING)) return;

    // Воспроизводим звук перелистывания
    this._playFlipSound();

    // Обновляем фон если уходим с обложки
    if (this.ctrl.index === 0 && targetIndex > 0) {
      this.ctrl.chapterDelegate.updateChapterUI(targetIndex);
    }

    this.renderer.prepareBuffer(targetIndex, this.isMobile);
    
    const nextIndex = targetIndex;
    this.renderer.prepareSheet(this.ctrl.index, nextIndex, direction, this.isMobile);

    try {
      await this.animator.runFlip(direction, () => {
        this.ctrl.index = targetIndex;
        this.renderer.swapBuffers();
      });

      this.state.transitionTo(BookState.OPENED);
      this.settings.set("page", this.ctrl.index);
      this.ctrl.chapterDelegate.updateChapterUI();
      this.ctrl._updateDebug();
    } catch (error) {
      this.state.transitionTo(BookState.OPENED);
    }
  }

  /**
   * Переворот страницы вперёд/назад
   * @param {'next'|'prev'} direction
   */
  async flip(direction) {
    if (this.ctrl.isDestroyed) return;

    // Открываем книгу если закрыта
    if (!this.state.isOpened && direction === "next") {
      await this.ctrl.lifecycleDelegate.open();
      return;
    }

    // Закрываем если на первой странице
    if (this.state.isOpened && direction === "prev" && this.ctrl.index === 0) {
      await this.ctrl.lifecycleDelegate.close();
      return;
    }

    if (!this.state.isOpened || this.state.isBusy) return;

    const step = this.ctrl.pagesPerFlip;
    const nextIndex = direction === "next" 
      ? this.ctrl.index + step 
      : this.ctrl.index - step;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);

    if (nextIndex < 0 || nextIndex > maxIndex) return;

    if (!this.state.transitionTo(BookState.FLIPPING)) return;

    // Воспроизводим звук перелистывания
    this._playFlipSound();

    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    this.renderer.prepareSheet(this.ctrl.index, nextIndex, direction, this.isMobile);

    try {
      await this.animator.runFlip(direction, () => {
        this.ctrl.index = nextIndex;
        this.renderer.swapBuffers();
      });

      this.state.transitionTo(BookState.OPENED);
      this.settings.set("page", this.ctrl.index);
      this.ctrl.chapterDelegate.updateChapterUI();
      this.ctrl._updateDebug();
    } catch (error) {
      this.state.transitionTo(BookState.OPENED);
    }
  }

  /**
   * Воспроизвести звук перелистывания
   * @private
   */
  _playFlipSound() {
    if (this.soundManager) {
      // Небольшая вариация в скорости для естественности
      const playbackRate = 0.9 + Math.random() * 0.2;
      this.soundManager.play('pageFlip', { playbackRate });
    }
  }
}
