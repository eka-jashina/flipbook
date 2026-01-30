/**
 * CHAPTER DELEGATE
 * Управление главами книги.
 * 
 * Отвечает за:
 * - Определение текущей главы
 * - Обновление фона и UI главы
 * - Предзагрузку фонов следующих глав
 * 
 */

import { CONFIG } from '../../config.js';
import { BaseDelegate } from './BaseDelegate.js';

export class ChapterDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BackgroundManager} deps.backgroundManager
   * @param {DOMManager} deps.dom
   * @param {Object} deps.state - Объект состояния контроллера
   * @param {number} deps.state.index
   * @param {number[]} deps.state.chapterStarts
   */
  constructor(deps) {
    super(deps);
    this.lastPreloadedChapter = -1;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['backgroundManager', 'dom', 'state'],
      'ChapterDelegate'
    );
  }

  /**
   * Определить текущую главу по индексу страницы
   * @param {number} pageIndex
   * @returns {number}
   */
  getCurrentChapter(pageIndex = this.currentIndex) {
    let current = 0;
    for (let i = 0; i < this.chapterStarts.length; i++) {
      if (this.chapterStarts[i] <= pageIndex) {
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
   * Обновить фон главы
   * @param {number} pageIndex - Индекс текущей страницы
   * @param {boolean} isMobile - Мобильный режим
   */
  updateBackground(pageIndex, isMobile) {
    // Страницы до первой главы (оглавление) используют фон обложки
    const firstChapterStart = this.chapterStarts[0] ?? 0;
    if (pageIndex < firstChapterStart) {
      const body = this.dom.get('body');
      if (body) {
        body.dataset.chapter = 'cover';
      }
      const coverBg = isMobile ? CONFIG.COVER_BG_MOBILE : CONFIG.COVER_BG;
      this.backgroundManager.setBackground(coverBg);
      return;
    }

    const currentChapter = this.getCurrentChapter(pageIndex);
    const chapterInfo = CONFIG.CHAPTERS[currentChapter];

    if (!chapterInfo) return;

    // Обновить data-атрибут для стилей
    const body = this.dom.get('body');
    if (body) {
      body.dataset.chapter = chapterInfo.id;
    }

    // Установить фон главы (мобильная или полная версия)
    const bgUrl = isMobile ? chapterInfo.bgMobile : chapterInfo.bg;
    if (bgUrl) {
      this.backgroundManager.setBackground(bgUrl);
    }

    // Предзагрузить следующую главу
    if (!isMobile) {
      this._preloadNextChapter(currentChapter);
    }
  }

  /**
   * Предзагрузить фон следующей главы
   * @private
   * @param {number} currentChapter
   */
  _preloadNextChapter(currentChapter) {
    const nextChapter = this.getNextChapter(currentChapter);
    
    if (nextChapter !== null && nextChapter !== this.lastPreloadedChapter) {
      const nextChapterInfo = CONFIG.CHAPTERS[nextChapter];
      
      if (nextChapterInfo?.bg) {
        this.backgroundManager.preload(nextChapterInfo.bg);
        this.lastPreloadedChapter = nextChapter;
      }
    }
  }

  /**
   * Очистка
   */
  destroy() {
    this.lastPreloadedChapter = -1;
    super.destroy();
  }
}
