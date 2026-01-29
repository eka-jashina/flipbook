/**
 * DRAG DELEGATE
 * Управление drag-перелистыванием страниц.
 *
 * Жизненный цикл drag-операции:
 * 1. _startDrag()     → Инициализация: проверка возможности, захват координат
 * 2. _prepareFlip()   → Подготовка DOM: буфер, sheet, отключение transitions
 * 3. _showUnderPage() → Показ страницы "под" текущей (целевая страница)
 * 4. _updateAngle()   → Цикл: обновление угла по позиции курсора/пальца
 * 5. _render()        → Цикл: применение угла к CSS-переменным
 * 6. _updateShadows() → Цикл: расчёт и применение теней
 * 7. _endDrag()       → Решение: завершить (>90°) или отменить (<90°)
 * 8. _animateTo()     → Анимация до целевого угла (0° или 180°)
 * 9. _finish()        → Очистка CSS-переменных и состояния sheet
 * 10. _completeFlip() → При успехе: swap буферов, обновление индекса
 *     _cancelFlip()   → При отмене: возврат видимости страниц
 */

import { cssVars } from "../../utils/CSSVariables.js";
import { BaseDelegate } from './BaseDelegate.js';

export class DragDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BookStateMachine} deps.stateMachine
   * @param {BookRenderer} deps.renderer
   * @param {BookAnimator} deps.animator
   * @param {SoundManager} deps.soundManager
   * @param {DOMManager} deps.dom
   * @param {EventListenerManager} deps.eventManager
   * @param {MediaQueryManager} deps.mediaQueries
   * @param {Object} deps.state
   * @param {Function} deps.onIndexChange - Коллбэк при изменении индекса
   * @param {Function} deps.onChapterUpdate - Коллбэк для обновления UI главы
   */
  constructor(deps) {
    super(deps);
    this.eventManager = deps.eventManager;
    this.onIndexChange = deps.onIndexChange;
    this.onChapterUpdate = deps.onChapterUpdate;

    // Состояние drag
    this.isDragging = false;
    this.direction = null;
    this.currentAngle = 0;
    this.startX = 0;

    // Кэшированные значения
    this.bookWidth = 0;
    this.bookRect = null;
    this._pageRefs = null;

    // Привязанные обработчики для корректного удаления
    this._boundHandlers = {
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onTouchMove: this._onTouchMove.bind(this),
      onTouchEnd: this._onTouchEnd.bind(this),
    };
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['stateMachine', 'renderer', 'dom', 'eventManager', 'mediaQueries', 'state'],
      'DragDelegate'
    );
  }

  /**
   * Количество страниц на переворот
   * @returns {number}
   */
  get pagesPerFlip() {
    return cssVars.getNumber("--pages-per-flip", this.isMobile ? 1 : 2);
  }

  /**
   * Активен ли drag в данный момент
   * @returns {boolean}
   */
  get isActive() {
    return this.isDragging;
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  /**
   * Привязать события к зонам захвата
   */
  bind() {
    const book = this.dom.get("book");
    if (!book) return;

    const corners = book.querySelectorAll(".corner-zone");

    corners.forEach((zone) => {
      this.eventManager.add(zone, "mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, zone.dataset.dir);
      });

      this.eventManager.add(
        zone,
        "touchstart",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._startDrag(e.touches[0], zone.dataset.dir);
        },
        { passive: false },
      );
    });

    // Глобальные обработчики движения и отпускания
    this.eventManager.add(document, "mousemove", this._boundHandlers.onMouseMove);
    this.eventManager.add(document, "mouseup", this._boundHandlers.onMouseUp);
    this.eventManager.add(document, "touchmove", this._boundHandlers.onTouchMove, { passive: false });
    this.eventManager.add(document, "touchend", this._boundHandlers.onTouchEnd);
  }

  // ═══════════════════════════════════════════
  // ПРОВЕРКИ ВОЗМОЖНОСТИ ДЕЙСТВИЯ
  // ═══════════════════════════════════════════

  /**
   * Проверить возможность перелистывания вперёд
   * @returns {boolean} true если есть следующие страницы
   */
  canFlipNext() {
    if (!this.isOpened) return false;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    return this.currentIndex + this.pagesPerFlip <= maxIndex;
  }

  /**
   * Проверить возможность перелистывания назад
   * @returns {boolean} true если есть предыдущие страницы
   */
  canFlipPrev() {
    if (!this.isOpened) return false;
    return this.currentIndex > 0;
  }

  // ═══════════════════════════════════════════
  // DRAG LIFECYCLE
  // ═══════════════════════════════════════════

  /**
   * Начать drag-операцию
   * @private
   * @param {MouseEvent|Touch} e - Событие мыши или touch
   * @param {string} dir - Направление: 'next' или 'prev'
   */
  _startDrag(e, dir) {
    if (this.isBusy) return;

    if (dir === "next" && !this.canFlipNext()) return;
    if (dir === "prev" && !this.canFlipPrev()) return;

    this.isDragging = true;
    this.direction = dir;
    this.startX = e.clientX;
    this.currentAngle = 0;

    const book = this.dom.get("book");
    if (!book) return;

    this.bookRect = book.getBoundingClientRect();
    this.bookWidth = this.bookRect.width;

    this._prepareFlip();

    const flipShadow = this.dom.get("flipShadow");
    if (flipShadow) {
      flipShadow.classList.add("active");
      flipShadow.dataset.direction = this.direction;
    }

    this._updateAngleFromEvent(e);
  }

  /**
   * Подготовить DOM к перелистыванию:
   * - Отключить transitions для мгновенного обновления
   * - Подготовить буфер с целевой страницей
   * - Настроить sheet для drag-режима
   * @private
   */
  _prepareFlip() {
    const nextIndex =
      this.direction === "next"
        ? this.currentIndex + this.pagesPerFlip
        : this.currentIndex - this.pagesPerFlip;

    const book = this.dom.get("book");

    // Отключаем transitions ДО изменения видимости страниц,
    // чтобы избежать мигания белого фона на мобильных
    if (book) {
      book.dataset.noTransition = "true";
    }

    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    this.renderer.prepareSheet(this.currentIndex, nextIndex, this.direction, this.isMobile);
    this._showUnderPage();

    const sheet = this.dom.get("sheet");

    if (sheet) {
      sheet.dataset.direction = this.direction;
      sheet.dataset.phase = "drag";
      sheet.classList.add("no-transition");
    }

    if (book) {
      book.dataset.state = "flipping";
    }
  }

  /**
   * Показать страницу "под" текущей (целевую страницу).
   * Буферная страница становится видимой, активная скрывается.
   * @private
   */
  _showUnderPage() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.renderer.elements;
    this._pageRefs = { leftActive, rightActive, leftBuffer, rightBuffer };

    if (this.isMobile) {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = "false";
        rightBuffer.dataset.dragVisible = "true";
      }
      if (rightActive) rightActive.dataset.dragHidden = "true";
    } else if (this.direction === "next") {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = "false";
        rightBuffer.dataset.dragVisible = "true";
      }
      if (rightActive) rightActive.dataset.dragHidden = "true";
    } else {
      if (leftBuffer) {
        leftBuffer.dataset.buffer = "false";
        leftBuffer.dataset.dragVisible = "true";
      }
      if (leftActive) leftActive.dataset.dragHidden = "true";
    }
  }

  // ═══════════════════════════════════════════
  // ДВИЖЕНИЕ
  // ═══════════════════════════════════════════

  /** @private Обработчик движения мыши */
  _onMouseMove(e) {
    if (!this.isDragging) return;
    this._updateAngleFromEvent(e);
  }

  /** @private Обработчик движения touch */
  _onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this._updateAngleFromEvent(e.touches[0]);
  }

  /**
   * Пересчитать угол поворота страницы по позиции курсора.
   * Угол 0° = страница на месте, 180° = полностью перевёрнута.
   * @private
   * @param {MouseEvent|Touch} e - Событие с координатами
   */
  _updateAngleFromEvent(e) {
    if (!this.bookRect) return;

    const x = e.clientX - this.bookRect.left;

    if (this.direction === "next") {
      const progress = 1 - x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    } else {
      const progress = x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    }

    this._render();
  }

  /**
   * Применить текущий угол к CSS-переменным sheet
   * @private
   */
  _render() {
    const angle = this.direction === "next" ? -this.currentAngle : this.currentAngle;

    const sheet = this.dom.get("sheet");
    if (sheet) {
      sheet.style.setProperty("--sheet-angle", `${angle}deg`);
    }

    this._updateShadows();
  }

  /**
   * Обновить тени в зависимости от угла поворота.
   * Тени максимальны при 90° (sin(π/2) = 1) и минимальны при 0°/180°.
   * @private
   */
  _updateShadows() {
    const progress = this.currentAngle / 180;
    const shadowOpacity = Math.sin(progress * Math.PI) * 0.35;
    const shadowSize = Math.sin(progress * Math.PI) * 25;

    const book = this.dom.get("book");
    if (book) {
      book.style.setProperty("--spine-shadow-alpha", shadowOpacity.toFixed(2));
      book.style.setProperty("--spine-shadow-size", `${shadowSize}px`);
    }

    const flipShadow = this.dom.get("flipShadow");
    if (!flipShadow) return;

    const flipOpacity = Math.sin(progress * Math.PI) * 0.4;
    const flipWidth = Math.sin(progress * Math.PI) * 120;
    const spinePosition = this.isMobile ? "10%" : "50%";

    // Позиционирование через CSS-переменные, градиент через data-direction в CSS
    const leftPosition = this.direction === "next"
      ? spinePosition
      : `calc(${spinePosition} - ${flipWidth}px)`;

    flipShadow.style.setProperty("--flip-shadow-opacity", flipOpacity.toFixed(2));
    flipShadow.style.setProperty("--flip-shadow-width", `${flipWidth}px`);
    flipShadow.style.setProperty("--flip-shadow-left", leftPosition);
  }

  // ═══════════════════════════════════════════
  // ЗАВЕРШЕНИЕ
  // ═══════════════════════════════════════════

  /** @private Обработчик отпускания мыши */
  _onMouseUp() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /** @private Обработчик окончания touch */
  _onTouchEnd() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /**
   * Завершить drag-операцию.
   * Если угол > 90° — завершить перелистывание, иначе — отменить.
   * @private
   */
  _endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const willComplete = this.currentAngle > 90;
    this._animateTo(willComplete ? 180 : 0, willComplete);
  }

  /**
   * Анимировать угол до целевого значения (0° или 180°)
   * @private
   * @param {number} targetAngle - Целевой угол
   * @param {boolean} willComplete - Будет ли перелистывание завершено
   */
  _animateTo(targetAngle, willComplete) {
    const startAngle = this.currentAngle;
    const duration = Math.max(
      150,
      (cssVars.getTime("--timing-rotate", 350) * Math.abs(targetAngle - startAngle)) / 180,
    );
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      this.currentAngle = startAngle + (targetAngle - startAngle) * eased;
      this._render();

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this._finish(willComplete);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Финализация после завершения анимации.
   * Очищает CSS-переменные и вызывает _completeFlip или _cancelFlip.
   * @private
   * @param {boolean} completed - true если перелистывание успешно
   */
  _finish(completed) {
    const direction = this.direction;

    const sheet = this.dom.get("sheet");
    const book = this.dom.get("book");
    const flipShadow = this.dom.get("flipShadow");

    if (sheet) {
      sheet.classList.remove("no-transition");
      sheet.style.removeProperty("--sheet-angle");
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }

    if (book) {
      book.style.removeProperty("--spine-shadow-alpha");
      book.style.removeProperty("--spine-shadow-size");
    }

    if (flipShadow) {
      flipShadow.classList.remove("active");
      delete flipShadow.dataset.direction;
      flipShadow.style.removeProperty("--flip-shadow-opacity");
      flipShadow.style.removeProperty("--flip-shadow-width");
      flipShadow.style.removeProperty("--flip-shadow-left");
    }

    if (completed) {
      this._completeFlip(direction);
    } else {
      this._cancelFlip();
    }

    this.direction = null;
    this.currentAngle = 0;
    this._pageRefs = null;
  }

  /**
   * Завершить перелистывание: обменять буферы, обновить индекс, воспроизвести звук
   * @private
   * @param {string} direction - Направление перелистывания
   */
  _completeFlip(direction) {
    const book = this.dom.get("book");
    if (book) book.dataset.noTransition = "true";

    const newIndex =
      direction === "next"
        ? this.currentIndex + this.pagesPerFlip
        : this.currentIndex - this.pagesPerFlip;

    // Воспроизводим звук
    if (this.soundManager) {
      const playbackRate = 0.9 + Math.random() * 0.2;
      this.soundManager.play('pageFlip', { playbackRate });
    }

    this.renderer.swapBuffers();

    // Обновляем индекс через коллбэк
    if (this.onIndexChange) {
      this.onIndexChange(newIndex);
    }

    // Обновляем UI главы
    if (this.onChapterUpdate) {
      this.onChapterUpdate();
    }

    this._cleanupAfterFlip(book, true);
  }

  /**
   * Отменить перелистывание: вернуть страницы в исходное состояние
   * @private
   */
  _cancelFlip() {
    const book = this.dom.get("book");
    this._cleanupAfterFlip(book, false);
  }

  /**
   * Очистить DOM-атрибуты после перелистывания.
   * При отмене восстанавливает buffer-атрибуты, при успехе — нет
   * (swapBuffers уже корректно настроил их).
   * @private
   * @param {HTMLElement} book - Контейнер книги
   * @param {boolean} completed - Было ли перелистывание успешным
   */
  _cleanupAfterFlip(book, completed = false) {
    if (book) book.dataset.state = "opened";

    if (this._pageRefs) {
      const { leftActive, rightActive, leftBuffer, rightBuffer } = this._pageRefs;

      // Убираем скрытие для страниц
      if (leftActive) delete leftActive.dataset.dragHidden;
      if (rightActive) delete rightActive.dataset.dragHidden;

      // Удаляем dragVisible
      if (leftBuffer) delete leftBuffer.dataset.dragVisible;
      if (rightBuffer) delete rightBuffer.dataset.dragVisible;

      // Атрибуты buffer устанавливаем только при отмене флипа.
      // При успешном флипе swapBuffers() уже корректно настроил атрибуты,
      // и изменение их по старым ссылкам скроет активную страницу.
      if (!completed) {
        if (leftBuffer) leftBuffer.dataset.buffer = "true";
        if (rightBuffer) rightBuffer.dataset.buffer = "true";
      }
    }

    if (book) {
      requestAnimationFrame(() => {
        if (book) delete book.dataset.noTransition;
      });
    }
  }

  /**
   * Очистка
   */
  destroy() {
    this.isDragging = false;
    this.direction = null;
    this.currentAngle = 0;
    this.bookWidth = 0;
    this.bookRect = null;
    this._pageRefs = null;
    this._boundHandlers = null;
    this.eventManager = null;
    this.onIndexChange = null;
    this.onChapterUpdate = null;
    super.destroy();
  }
}
