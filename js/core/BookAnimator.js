/**
 * BOOK ANIMATOR
 * Управляет CSS-анимациями книги.
 *
 * Особенности:
 * - Трёхфазная анимация перелистывания: lift → rotate → drop
 * - Анимации открытия/закрытия книги
 * - Поддержка отмены операций через AbortController
 * - Тайминги читаются из CSS-переменных
 */

import { cssVars } from '../utils/CSSVariables.js';
import { TransitionHelper } from '../utils/TransitionHelper.js';
import { CONFIG } from '../config.js';

export class BookAnimator {
  /**
   * @param {Object} options - Конфигурация аниматора
   * @param {HTMLElement} options.book - Контейнер книги
   * @param {HTMLElement} options.bookWrap - Внешняя обёртка книги
   * @param {HTMLElement} options.cover - Обложка книги
   * @param {HTMLElement} options.sheet - Перелистываемый лист
   * @param {HTMLElement} options.sheetFront - Лицевая сторона листа
   * @param {HTMLElement} options.sheetBack - Оборотная сторона листа
   * @param {TimerManager} options.timerManager - Менеджер таймеров
   */
  constructor(options) {
    this.elements = {
      book: options.book,
      bookWrap: options.bookWrap,
      cover: options.cover,
      sheet: options.sheet,
      sheetFront: options.sheetFront,
      sheetBack: options.sheetBack,
    };

    this.timerManager = options.timerManager;
    /** @type {AbortController|null} Контроллер текущей операции */
    this.operationController = null;
  }

  /**
   * Получить все тайминги анимаций из CSS-переменных
   * @returns {Object} Объект с таймингами в мс
   */
  getTimings() {
    return {
      lift: cssVars.getTime("--timing-lift", 240),
      rotate: cssVars.getTime("--timing-rotate", 900),
      drop: cssVars.getTime("--timing-drop", 160),
      cover: cssVars.getTime("--timing-cover", 1200),
      wrap: cssVars.getTime("--timing-wrap", 300),
      swapNext: cssVars.getTime("--timing-swap-next", 30),
      swapPrev: cssVars.getTime("--timing-swap-prev", 100),
    };
  }

  /**
   * Создать новый AbortSignal для операции (отменяет предыдущую)
   * @returns {AbortSignal}
   */
  createSignal() {
    this.abort();
    this.operationController = new AbortController();
    return this.operationController.signal;
  }

  /**
   * Отменить текущую операцию
   */
  abort() {
    if (this.operationController) {
      this.operationController.abort();
      this.operationController = null;
    }
  }

  /**
   * Запустить анимацию перелистывания страницы
   * Фазы: lift (поднятие) → rotate (поворот) → drop (опускание)
   * @param {'next'|'prev'} direction - Направление перелистывания
   * @param {Function} onSwap - Коллбэк для подмены буферов (вызывается во время rotate)
   */
  async runFlip(direction, onSwap) {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { book, sheet } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    book.dataset.state = "flipping";
    sheet.dataset.direction = direction;
    delete sheet.dataset.phase;

    try {
      // Фаза 1: Lift (поднятие страницы)
      this.timerManager.requestAnimationFrame(() => {
        if (!signal.aborted) {
          sheet.dataset.phase = "lift";
        }
      });

      await TransitionHelper.waitFor(
        sheet, "transform", timings.lift + safetyMargin, signal
      );

      // Фаза 2: Rotate (поворот страницы на 180°)
      sheet.dataset.phase = "rotate";

      // Подмена буферов происходит в середине поворота.
      // Проверяем signal.aborted перед вызовом, чтобы избежать
      // неконсистентного состояния при отмене операции.
      const swapDelay = direction === "next" ? timings.swapNext : timings.swapPrev;
      this.timerManager.setTimeout(() => {
        if (!signal.aborted) {
          onSwap();
        }
      }, swapDelay);

      // Переключаем стороны листа в середине поворота (на ~90°),
      // чтобы избежать зеркального отражения из-за ненадёжного backface-visibility
      this._scheduleSideSwitch(timings.rotate, signal);

      await TransitionHelper.waitFor(
        sheet, "transform", timings.rotate + safetyMargin, signal
      );

      // Фаза 3: Drop (опускание страницы)
      sheet.dataset.phase = "drop";

      await TransitionHelper.waitFor(
        sheet, "transform", timings.drop + safetyMargin, signal
      );

    } finally {
      // Очистка data-атрибутов независимо от результата
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
      this._resetSideStyles();
    }
  }

  /**
   * Запустить анимацию открытия книги (первая часть)
   * @returns {Promise<AbortSignal|null>} Signal для продолжения или null при отмене
   */
  async runOpenAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    // Устанавливаем начальные состояния
    bookWrap.dataset.state = "opened";
    book.dataset.state = "opening";
    cover.dataset.animation = "opening";

    try {
      // Ждём расширения обёртки
      await TransitionHelper.waitFor(
        bookWrap, "width", timings.wrap + safetyMargin, signal
      );

      // Два RAF для стабилизации layout
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      return signal;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
      return null;
    }
  }

  /**
   * Завершить анимацию открытия книги (вторая часть)
   * @param {AbortSignal} signal - Signal от runOpenAnimation
   */
  async finishOpenAnimation(signal) {
    const timings = this.getTimings();
    const { cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    // Ждём завершения анимации обложки
    await TransitionHelper.waitFor(
      cover, "transform", timings.cover + safetyMargin, signal
    );

    delete cover.dataset.animation;
  }

  /**
   * Запустить анимацию закрытия книги
   */
  async runCloseAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    // Устанавливаем состояния закрытия
    bookWrap.dataset.state = "closed";
    book.dataset.state = "closing";
    cover.dataset.animation = "closing";

    try {
      // Параллельно анимируем обёртку и обложку
      await Promise.all([
        TransitionHelper.waitFor(bookWrap, "width", timings.wrap + safetyMargin, signal),
        TransitionHelper.waitFor(cover, "transform", timings.cover + safetyMargin, signal),
      ]);

      delete cover.dataset.animation;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
  }

  /**
   * Скрыть лицевую сторону листа перед серединой поворота,
   * чтобы её задняя грань не просвечивала зеркальным отражением.
   * backface-visibility остаётся hidden — opacity лишь подстраховка.
   * @private
   * @param {number} rotateDuration - Длительность фазы rotate (мс)
   * @param {AbortSignal} signal
   */
  _scheduleSideSwitch(rotateDuration, signal) {
    const { sheetFront } = this.elements;
    if (!sheetFront) return;

    // Скрываем front чуть раньше 90° (40% длительности с учётом easing),
    // чтобы гарантированно успеть до момента, когда задняя грань видна
    const midpoint = rotateDuration * 0.4;
    this.timerManager.setTimeout(() => {
      if (!signal.aborted) {
        sheetFront.style.opacity = "0";
      }
    }, midpoint);
  }

  /**
   * Сбросить inline-стили сторон листа после анимации
   * @private
   */
  _resetSideStyles() {
    const { sheetFront } = this.elements;
    if (sheetFront) {
      sheetFront.style.removeProperty("opacity");
    }
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.abort();
    this.elements = null;
  }
}
