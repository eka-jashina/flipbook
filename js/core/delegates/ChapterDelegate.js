/**
 * CHAPTER DELEGATE
 * Управление главами книги.
 * 
 * Отвечает за:
 * - Определение текущей главы
 * - Обновление фона и UI главы
 * - Предзагрузку фонов следующих глав
 * 
 * Обновлено для работы с DOMManager.
 */

import { CONFIG } from '../../config.js';

export class ChapterDelegate {
  constructor(controller) {
    this.ctrl = controller;
    this.lastPreloadedChapter = -1;
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
   * Получить следующую главу
   * @param {number} currentChapter
   * @returns {number|null}
   */
  getNextChapter(currentChapter) {
    const nextChapter = currentChapter + 1;
    return nextChapter < CONFIG.CHAPTERS.length ? nextChapter : null;
  }

  /**
   * Обновить UI главы (фон, data-атрибут) и предзагрузить следующий фон
   * @param {number} [pageIndex]
   */
  updateChapterUI(pageIndex = this.ctrl.index) {
    if (this.ctrl.isDestroyed) return;

    const body = this.ctrl.dom.get('body');
    if (!body) return;

    if (!this.ctrl.stateMachine.isOpened || pageIndex === 0) {
      this.ctrl.backgroundManager.setBackground(CONFIG.COVER_BG);
      body.dataset.chapter = "cover";
      
      // Предзагружаем фон первой главы когда на обложке
      if (CONFIG.CHAPTERS[0]) {
        this.ctrl.backgroundManager.preload(CONFIG.CHAPTERS[0].bg, true);
      }
      return;
    }

    if (!this.ctrl.chapterStarts.length) return;

    const chapterIndex = this.getCurrentChapter(pageIndex);
    const chapter = CONFIG.CHAPTERS[chapterIndex];

    if (chapter) {
      this.ctrl.backgroundManager.setBackground(chapter.bg);
      body.dataset.chapter = chapter.id;
      
      // Предзагружаем фон следующей главы
      this._preloadNextChapterBackground(chapterIndex);
    }
  }

  /**
   * Предзагрузить фон следующей главы
   * @private
   * @param {number} currentChapter
   */
  _preloadNextChapterBackground(currentChapter) {
    // Не предзагружаем повторно
    if (this.lastPreloadedChapter === currentChapter + 1) {
      return;
    }

    const nextChapter = this.getNextChapter(currentChapter);
    
    if (nextChapter !== null) {
      const nextChapterData = CONFIG.CHAPTERS[nextChapter];
      
      if (nextChapterData && nextChapterData.bg) {
        this.ctrl.backgroundManager.preload(nextChapterData.bg)
          .then(() => {
            this.lastPreloadedChapter = nextChapter;
          });
      }
    }
  }

  /**
   * Предзагрузить все фоны глав (для быстрого интернета)
   * @returns {Promise<void>}
   */
  async preloadAllBackgrounds() {
    const urls = [
      CONFIG.COVER_BG,
      ...CONFIG.CHAPTERS.map(ch => ch.bg).filter(Boolean)
    ];

    return this.ctrl.backgroundManager.preloadMultiple(urls);
  }
}
