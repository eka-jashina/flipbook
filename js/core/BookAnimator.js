/**
 * BOOK ANIMATOR
 * Управляет CSS-анимациями книги.
 */

import { cssVars } from '../utils/CSSVariables.js';
import { TransitionHelper } from '../utils/TransitionHelper.js';
import { CONFIG } from '../config.js';

export class BookAnimator {
  constructor(options) {
    this.elements = {
      book: options.book,
      bookWrap: options.bookWrap,
      cover: options.cover,
      sheet: options.sheet,
    };

    this.timerManager = options.timerManager;
    this.operationController = null;
  }

  getTimings() {
    return {
      lift: cssVars.getTime("--timing-lift", 240),
      rotate: cssVars.getTime("--timing-rotate", 800),
      drop: cssVars.getTime("--timing-drop", 160),
      cover: cssVars.getTime("--timing-cover", 1200),
      wrap: cssVars.getTime("--timing-wrap", 300),
      swapNext: cssVars.getTime("--timing-swap-next", 100),
      swapPrev: cssVars.getTime("--timing-swap-prev", 100),
    };
  }

  createSignal() {
    this.abort();
    this.operationController = new AbortController();
    return this.operationController.signal;
  }

  abort() {
    if (this.operationController) {
      this.operationController.abort();
      this.operationController = null;
    }
  }

  async runFlip(direction, onSwap) {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { book, sheet } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    book.dataset.state = "flipping";
    sheet.dataset.direction = direction;
    delete sheet.dataset.phase;

    try {
      // Lift
      this.timerManager.requestAnimationFrame(() => {
        if (!signal.aborted) {
          sheet.dataset.phase = "lift";
        }
      });

      await TransitionHelper.waitFor(
        sheet, "transform", timings.lift + safetyMargin, signal
      );

      // Rotate
      sheet.dataset.phase = "rotate";

      const swapDelay = direction === "next" ? timings.swapNext : timings.swapPrev;
      this.timerManager.setTimeout(onSwap, swapDelay);

      await TransitionHelper.waitFor(
        sheet, "transform", timings.rotate + safetyMargin, signal
      );

      // Drop
      sheet.dataset.phase = "drop";

      await TransitionHelper.waitFor(
        sheet, "transform", timings.drop + safetyMargin, signal
      );

    } finally {
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }
  }

  async runOpenAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    bookWrap.dataset.state = "opened";
    book.dataset.state = "opening";
    cover.dataset.animation = "opening";

    try {
      await TransitionHelper.waitFor(
        bookWrap, "width", timings.wrap + safetyMargin, signal
      );

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

  async finishOpenAnimation(signal) {
    const timings = this.getTimings();
    const { cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    await TransitionHelper.waitFor(
      cover, "transform", timings.cover + safetyMargin, signal
    );

    delete cover.dataset.animation;
  }

  async runCloseAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = CONFIG.TIMING_SAFETY_MARGIN;

    bookWrap.dataset.state = "closed";
    book.dataset.state = "closing";
    cover.dataset.animation = "closing";

    try {
      await Promise.all([
        TransitionHelper.waitFor(bookWrap, "width", timings.wrap + safetyMargin, signal),
        TransitionHelper.waitFor(cover, "transform", timings.cover + safetyMargin, signal),
      ]);

      delete cover.dataset.animation;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
  }

  destroy() {
    this.abort();
    this.elements = null;
  }
}
