/**
 * EVENT CONTROLLER
 * Обработка всех пользовательских событий.
 */

import { cssVars } from '../utils/CSSVariables.js';
import { mediaQueries } from '../utils/MediaQueryManager.js';

export class EventController {
  constructor(options) {
    this.book = options.book;
    this.eventManager = options.eventManager;
    
    this.onFlip = options.onFlip;
    this.onTOCClick = options.onTOCClick;
    this.onOpen = options.onOpen;
    this.onSettings = options.onSettings;
    
    this.isBusy = options.isBusy;
    this.isOpened = options.isOpened;

    this.touchStartX = 0;
    this.touchStartY = 0;

    this._boundHandlers = {};
  }

  bind(elements) {
    this._bindNavigationButtons(elements);
    this._bindBookInteractions();
    this._bindSettingsControls(elements);
    this._bindKeyboard();
    this._bindTouch();
  }

  _bindNavigationButtons(elements) {
    const { nextBtn, prevBtn, tocBtn, continueBtn, coverEl } = elements;

    this.eventManager.add(nextBtn, "pointerdown", (e) => {
      e.preventDefault();
      if (this.isBusy()) return;
      this.onFlip("next");
    });

    this.eventManager.add(prevBtn, "pointerdown", (e) => {
      e.preventDefault();
      if (this.isBusy()) return;
      this.onFlip("prev");
    });

    this.eventManager.add(tocBtn, "click", () => {
      this.onTOCClick();
    });

    this.eventManager.add(continueBtn, "click", () => {
      if (this.isBusy()) return;
      this.onOpen(true);
      continueBtn.hidden = true;
    });

    this.eventManager.add(coverEl, "click", () => {
      if (!this.isOpened() && !this.isBusy()) {
        this.onFlip("next");
      }
    });
  }

  _bindBookInteractions() {
    const isMobile = mediaQueries.get("mobile");

    this.eventManager.add(this.book, "click", (e) => {
      const li = e.target.closest(".toc li");
      if (!li) return;
      e.preventDefault();

      const chapter = +li.dataset.chapter;
      this.onTOCClick(chapter);
    });

    if (!isMobile) {
      this.eventManager.add(this.book, "pointerdown", (e) => {
        if (this.isBusy() || !this.isOpened()) return;
        if (e.target.closest(".toc")) return;
        
        // Исключаем зоны захвата углов - там работает drag
        if (e.target.closest(".corner-zone")) return;

        const rect = this.book.getBoundingClientRect();
        const x = e.clientX - rect.left;

        this.onFlip(x < rect.width / 2 ? "prev" : "next");
      });
    }
  }

  _bindSettingsControls(elements) {
    const { increaseBtn, decreaseBtn, fontSelect, themeSelect, debugToggle } = elements;

    this.eventManager.add(increaseBtn, "click", () => {
      this.onSettings("fontSize", "increase");
    });

    this.eventManager.add(decreaseBtn, "click", () => {
      this.onSettings("fontSize", "decrease");
    });

    this.eventManager.add(fontSelect, "change", (e) => {
      this.onSettings("font", e.target.value);
    });

    this.eventManager.add(themeSelect, "change", (e) => {
      this.onSettings("theme", e.target.value);
    });

    this.eventManager.add(debugToggle, "click", () => {
      this.onSettings("debug", "toggle");
    });
  }

  _bindKeyboard() {
    this._boundHandlers.keydown = (e) => {
      if (this.isBusy()) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          this.onFlip("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          this.onFlip("next");
          break;
        case "Home":
          e.preventDefault();
          if (this.isOpened()) this.onTOCClick(0);
          break;
        case "End":
          e.preventDefault();
          if (this.isOpened()) this.onTOCClick(-1);
          break;
        case "d":
          if (e.ctrlKey) {
            e.preventDefault();
            this.onSettings("debug", "toggle");
          }
          break;
      }
    };

    this.eventManager.add(document, "keydown", this._boundHandlers.keydown);
  }

  _bindTouch() {
    this._boundHandlers.touchstart = (e) => {
      if (this.isBusy()) return;
      
      // Исключаем зоны захвата углов - там работает drag
      if (e.target.closest(".corner-zone")) return;
      
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
    };

    this._boundHandlers.touchend = (e) => {
      if (this.isBusy()) return;
      
      // Исключаем зоны захвата углов
      if (e.target.closest(".corner-zone")) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;

      const swipeVerticalLimit = cssVars.getNumber("--swipe-vertical-limit", 30);
      const swipeThreshold = cssVars.getNumber("--swipe-threshold", 20);

      if (Math.abs(dy) > swipeVerticalLimit) return;
      if (Math.abs(dx) < swipeThreshold) return;

      this.onFlip(dx < 0 ? "next" : "prev");
    };

    this.eventManager.add(this.book, "touchstart", this._boundHandlers.touchstart, { passive: true });
    this.eventManager.add(this.book, "touchend", this._boundHandlers.touchend);
  }

  destroy() {
    this._boundHandlers = {};
  }
}