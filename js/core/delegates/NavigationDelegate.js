/**
 * NAVIGATION DELEGATE - REFACTORED
 * Управление навигацией по книге.
 */

import { BookState, Direction, CONFIG } from '../../config.js';
import { BaseDelegate, DelegateEvents } from './BaseDelegate.js';

/** @constant {number} Минимальный интервал между перелистываниями (мс) */
const FLIP_THROTTLE_MS = CONFIG.TIMING?.FLIP_THROTTLE ?? 100;

export class NavigationDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BookStateMachine} deps.stateMachine
   * @param {BookRenderer} deps.renderer
   * @param {BookAnimator} deps.animator
   * @param {SettingsManager} deps.settings
   * @param {SoundManager} deps.soundManager
   * @param {MediaQueryManager} deps.mediaQueries
   * @param {Object} deps.state - Объект состояния контроллера
   */
  constructor(deps) {
    super(deps);
    /** @type {number} Timestamp последнего перелистывания */
    this._lastFlipTime = 0;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['stateMachine', 'renderer', 'animator', 'settings', 'mediaQueries', 'state'],
      'NavigationDelegate'
    );
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЕ МЕТОДЫ НАВИГАЦИИ
  // ═══════════════════════════════════════════

  /**
   * Переворот страницы вперёд/назад
   *
   * Включает rate limiting для защиты от быстрых повторных кликов.
   *
   * @param {'next'|'prev'} direction
   */
  async flip(direction) {
    // Rate limiting: игнорируем слишком частые вызовы
    const now = Date.now();
    if (now - this._lastFlipTime < FLIP_THROTTLE_MS) {
      return;
    }

    // Открываем книгу если закрыта и направление "next"
    if (!this.isOpened && direction === Direction.NEXT) {
      this._lastFlipTime = now;
      this.emit(DelegateEvents.BOOK_OPEN);
      return;
    }

    // Закрываем если на первой странице и направление "prev"
    if (this.isOpened && direction === Direction.PREV && this.currentIndex === 0) {
      this._lastFlipTime = now;
      this.emit(DelegateEvents.BOOK_CLOSE);
      return;
    }

    // Не продолжаем если книга не открыта или занята
    if (!this.isOpened || this.isBusy) {
      return;
    }

    const step = this.pagesPerFlip;
    const nextIndex = direction === Direction.NEXT
      ? this.currentIndex + step
      : this.currentIndex - step;

    const maxIndex = this.renderer.getMaxIndex(this.isMobile);

    if (nextIndex < 0 || nextIndex > maxIndex) {
      return;
    }

    this._lastFlipTime = now;
    await this._executeFlip(direction, nextIndex);
  }

  /**
   * Навигация по оглавлению
   * @param {number|undefined} chapter
   */
  async handleTOCNavigation(chapter) {
    // Если книга закрыта - просто открываем
    if (!this.isOpened) {
      await this.flip(Direction.NEXT);
      return;
    }

    // Переход к началу книги
    if (chapter === undefined) {
      await this.flipToPage(0, Direction.PREV);
      return;
    }

    // Переход к концу книги
    if (chapter === -1) {
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      await this.flipToPage(maxIndex, Direction.NEXT);
      return;
    }

    // Переход к конкретной главе
    const pageIndex = this.chapterStarts[chapter];
    if (pageIndex == null) return;

    // Выравниваем по развороту для десктопа
    const targetIndex = this.isMobile ? pageIndex : pageIndex - (pageIndex % 2);
    const direction = targetIndex > this.currentIndex ? Direction.NEXT : Direction.PREV;

    await this.flipToPage(targetIndex, direction);
  }

  /**
   * Переход на конкретную страницу
   * @param {number} targetIndex
   * @param {'next'|'prev'} direction
   */
  async flipToPage(targetIndex, direction) {
    if (this.isBusy || !this.isOpened) {
      return;
    }

    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));

    if (this.currentIndex === targetIndex) {
      return;
    }

    await this._executeFlip(direction, targetIndex);
  }

  // ═══════════════════════════════════════════
  // ВНУТРЕННИЕ МЕТОДЫ
  // ═══════════════════════════════════════════

  /**
   * Выполнить анимацию перелистывания
   * @private
   * @param {'next'|'prev'} direction
   * @param {number} nextIndex
   */
  async _executeFlip(direction, nextIndex) {
    // Переходим в состояние FLIPPING
    if (!this.stateMachine.transitionTo(BookState.FLIPPING)) {
      return;
    }

    // Воспроизводим звук
    this._playFlipSound();

    // Подготавливаем буферы и анимированный лист
    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    this.renderer.prepareSheet(
      this.currentIndex,
      nextIndex,
      direction,
      this.isMobile
    );

    try {
      // Запускаем анимацию с коллбэком для swapBuffers
      await this.animator.runFlip(direction, () => {
        this.renderer.swapBuffers();
      });

      // Проверяем, не был ли компонент уничтожен во время анимации
      if (this.isDestroyed) {
        return;
      }

      // Возвращаемся в состояние OPENED
      this.stateMachine.transitionTo(BookState.OPENED);

      // Уведомляем контроллер об изменении индекса
      this.emit(DelegateEvents.INDEX_CHANGE, nextIndex);

    } catch (error) {
      // Игнорируем ошибки если компонент уничтожен
      if (this.isDestroyed) {
        return;
      }
      console.error('Navigation flip error:', error);
      // Используем forceTransitionTo — состояние может уже быть OPENED
      // если ошибка произошла после успешного transitionTo(OPENED)
      this.stateMachine.forceTransitionTo(BookState.OPENED);
    }
  }

  /**
   * Очистка
   */
  destroy() {
    super.destroy();
  }
}
