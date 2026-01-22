/**
 * Делегат управления главами.
 */

import { CONFIG } from '../../config.js';

export class ChapterDelegate {
  constructor(controller) {
    this.ctrl = controller;
  }

  /**
   * Определить текущую главу по индексу страницы
   * @param {number} pageIndex
   * @returns {number}
   */
  getCurrentChapter(pageIndex = this.ctrl.index) {
    let current = 0;
    for (let i = 0; i < this.ctrl.chapterStarts.length; i++) {
      if (this.ctrl.chapterStarts[i] <= pageIndex) {
        current = i;
      } else {
        break;
      }
    }
    return current;
  }

  /**
   * Обновить UI главы (фон, data-атрибут)
   * @param {number} [pageIndex]
   */
  updateChapterUI(pageIndex = this.ctrl.index) {
    if (this.ctrl.isDestroyed) return;

    if (!this.ctrl.stateMachine.isOpened || pageIndex === 0) {
      this.ctrl.backgroundManager.setBackground(CONFIG.COVER_BG);
      this.ctrl.elements.body.dataset.chapter = "cover";
      return;
    }

    if (!this.ctrl.chapterStarts.length) return;

    const chapterIndex = this.getCurrentChapter(pageIndex);
    const chapter = CONFIG.CHAPTERS[chapterIndex];

    if (chapter) {
      this.ctrl.backgroundManager.setBackground(chapter.bg);
      this.ctrl.elements.body.dataset.chapter = chapter.id;
    }
  }
}