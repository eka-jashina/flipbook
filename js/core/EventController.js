/**
 * EVENT CONTROLLER
 * Обработка всех пользовательских событий.
 *
 * Особенности:
 * - Централизованная обработка кликов, touch, keyboard
 * - Делегирование событий через коллбэки
 * - Поддержка swipe-жестов на мобильных
 * - Автоматическое определение зон клика (left/right half)
 */

import { cssVars } from "../utils/CSSVariables.js";
import { mediaQueries } from "../utils/MediaQueryManager.js";

export class EventController {
  /**
   * @param {Object} options - Конфигурация контроллера
   * @param {HTMLElement} options.book - Контейнер книги
   * @param {EventListenerManager} options.eventManager - Менеджер слушателей
   * @param {Function} options.onFlip - Коллбэк перелистывания ('next'|'prev')
   * @param {Function} options.onTOCClick - Коллбэк клика по оглавлению
   * @param {Function} options.onOpen - Коллбэк открытия книги
   * @param {Function} options.onSettings - Коллбэк изменения настроек
   * @param {Function} options.isBusy - Проверка занятости (анимация)
   * @param {Function} options.isOpened - Проверка открыта ли книга
   */
  constructor(options) {
    this.book = options.book;
    this.eventManager = options.eventManager;

    // Коллбэки для делегирования событий
    this.onFlip = options.onFlip;
    this.onTOCClick = options.onTOCClick;
    this.onOpen = options.onOpen;
    this.onSettings = options.onSettings;

    // Функции проверки состояния
    this.isBusy = options.isBusy;
    this.isOpened = options.isOpened;

    // Координаты начала touch для определения swipe
    this.touchStartX = 0;
    this.touchStartY = 0;

    /** @type {Object} Сохранённые обработчики для cleanup */
    this._boundHandlers = {};
  }

  /**
   * Привязать все обработчики событий
   * @param {Object} elements - DOM-элементы управления
   */
  bind(elements) {
    this._bindNavigationButtons(elements);
    this._bindBookInteractions();
    this._bindSettingsControls(elements);
    this._bindKeyboard();
    this._bindTouch();
  }

  /**
   * Привязать кнопки навигации (prev/next, TOC, continue)
   * @private
   * @param {Object} elements - DOM-элементы кнопок
   */
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

    // Клик по обложке открывает книгу
    this.eventManager.add(coverEl, "click", () => {
      if (!this.isOpened() && !this.isBusy()) {
        this.onFlip("next");
      }
    });
  }

  /**
   * Привязать взаимодействия с книгой (клики по страницам, TOC)
   * @private
   */
  _bindBookInteractions() {
    const isMobile = mediaQueries.get("mobile");

    // pointerup вместо click — Firefox Mobile не генерирует
    // synthetic click если элемент сдвинулся (transform) при :active
    this.eventManager.add(this.book, "pointerup", (e) => {
      const li = e.target.closest(".toc li");
      if (!li) return;
      e.preventDefault();

      const chapter = +li.dataset.chapter;
      this.onTOCClick(chapter);
    });

    // На desktop: клик по левой/правой половине книги перелистывает
    if (!isMobile) {
      this.eventManager.add(this.book, "pointerdown", (e) => {
        if (this.isBusy() || !this.isOpened()) return;
        if (e.target.closest(".toc")) return;

        // Исключаем зоны захвата углов - там работает drag
        if (e.target.closest(".corner-zone")) return;

        const rect = this.book.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Левая половина = prev, правая = next
        this.onFlip(x < rect.width / 2 ? "prev" : "next");
      });
    }
  }

  /**
   * Привязать элементы управления настройками
   * @private
   * @param {Object} elements - DOM-элементы настроек
   */
  _bindSettingsControls(elements) {
    const {
      increaseBtn,
      decreaseBtn,
      fontSizeValue,
      fontSelect,
      themeSegmented,
      debugToggle,
      soundToggle,
      volumeSlider,
      pageVolumeControl,
      ambientPills,
      ambientVolume,
      ambientVolumeWrapper,
      fullscreenBtn
    } = elements;

    // Font size stepper - с обновлением отображаемого значения
    this.eventManager.add(increaseBtn, "click", () => {
      this.onSettings("fontSize", "increase");
      this._updateFontSizeDisplay(fontSizeValue, 1);
    });

    this.eventManager.add(decreaseBtn, "click", () => {
      this.onSettings("fontSize", "decrease");
      this._updateFontSizeDisplay(fontSizeValue, -1);
    });

    this.eventManager.add(fontSelect, "change", (e) => {
      this.onSettings("font", e.target.value);
    });

    // Theme segmented control - клик по сегментам
    if (themeSegmented) {
      this.eventManager.add(themeSegmented, "click", (e) => {
        const segment = e.target.closest('.theme-segment');
        if (!segment) return;

        const theme = segment.dataset.theme;
        this.onSettings("theme", theme);

        // Обновить состояние всех сегментов
        const allSegments = themeSegmented.querySelectorAll('.theme-segment');
        allSegments.forEach(s => {
          const isActive = s.dataset.theme === theme;
          s.dataset.active = isActive;
          s.setAttribute('aria-checked', isActive);
        });
      });
    }

    this.eventManager.add(debugToggle, "click", () => {
      this.onSettings("debug", "toggle");
    });

    // Sound toggle - также обновляет состояние volume control
    if (soundToggle) {
      this.eventManager.add(soundToggle, "change", (e) => {
        const enabled = e.target.checked;
        this.onSettings("soundEnabled", enabled);

        // Обновить визуальное состояние volume control
        if (pageVolumeControl) {
          pageVolumeControl.classList.toggle('disabled', !enabled);
        }
      });
    }

    if (volumeSlider) {
      this.eventManager.add(volumeSlider, "input", (e) => {
        const volume = parseFloat(e.target.value) / 100;
        this.onSettings("soundVolume", volume);
      });
    }

    // Ambient pills - делегирование клика по контейнеру
    if (ambientPills) {
      this.eventManager.add(ambientPills, "click", (e) => {
        const pill = e.target.closest('.ambient-pill');
        if (!pill) return;

        const type = pill.dataset.type;
        this.onSettings("ambientType", type);

        // Обновить состояние всех pills
        const allPills = ambientPills.querySelectorAll('.ambient-pill');
        allPills.forEach(p => {
          const isActive = p.dataset.type === type;
          p.dataset.active = isActive;
          p.setAttribute('aria-checked', isActive);
        });

        // Показать/скрыть слайдер громкости
        if (ambientVolumeWrapper) {
          ambientVolumeWrapper.classList.toggle('visible', type !== 'none');
        }
      });
    }

    if (ambientVolume) {
      this.eventManager.add(ambientVolume, "input", (e) => {
        const volume = parseFloat(e.target.value) / 100;
        this.onSettings("ambientVolume", volume);
      });
    }

    // Fullscreen toggle
    if (fullscreenBtn) {
      this.eventManager.add(fullscreenBtn, "click", () => {
        this.onSettings("fullscreen", "toggle");
      });

      // Слушаем изменение состояния fullscreen для обновления UI
      this.eventManager.add(document, "fullscreenchange", () => {
        const isFullscreen = !!document.fullscreenElement;
        fullscreenBtn.classList.toggle("is-fullscreen", isFullscreen);
      });
    }
  }

  /**
   * Привязать клавиатурные сокращения
   * Arrows: навигация, Home/End: начало/конец, Ctrl+D: debug
   * @private
   */
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

  /**
   * Привязать touch-события для swipe-навигации
   * @private
   */
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

      const swipeVerticalLimit = cssVars.getNumber(
        "--swipe-vertical-limit",
        30,
      );
      const swipeThreshold = cssVars.getNumber("--swipe-threshold", 20);

      if (Math.abs(dy) > swipeVerticalLimit) return;
      if (Math.abs(dx) < swipeThreshold) return;

      this.onFlip(dx < 0 ? "next" : "prev");
    };

    this.eventManager.add(
      this.book,
      "touchstart",
      this._boundHandlers.touchstart,
      { passive: true },
    );
    this.eventManager.add(this.book, "touchend", this._boundHandlers.touchend);
  }

  /**
   * Обновить отображение размера шрифта
   * @private
   * @param {HTMLElement} element - Элемент отображения значения
   * @param {number} delta - Изменение (+1 или -1)
   */
  _updateFontSizeDisplay(element, delta) {
    if (!element) return;

    const minSize = cssVars.getNumber("--font-min", 14);
    const maxSize = cssVars.getNumber("--font-max", 22);
    const current = parseInt(element.textContent, 10) || 18;
    const newSize = Math.max(minSize, Math.min(maxSize, current + delta));

    element.textContent = newSize;
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this._boundHandlers = {};
  }
}
