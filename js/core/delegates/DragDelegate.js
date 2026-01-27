/**
 * DRAG DELEGATE
 * Управление drag-перелистыванием.
 * 
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

  canFlipNext() {
    if (!this.isOpened) return false;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    return this.currentIndex + this.pagesPerFlip <= maxIndex;
  }

  canFlipPrev() {
    if (!this.isOpened) return false;
    return this.currentIndex > 0;
  }

  // ═══════════════════════════════════════════
  // DRAG LIFECYCLE
  // ═══════════════════════════════════════════

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
    if (flipShadow) flipShadow.classList.add("active");

    this._updateAngleFromEvent(e);
  }

  _prepareFlip() {
    const nextIndex =
      this.direction === "next"
        ? this.currentIndex + this.pagesPerFlip
        : this.currentIndex - this.pagesPerFlip;

    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    this.renderer.prepareSheet(this.currentIndex, nextIndex, this.direction, this.isMobile);
    this._showUnderPage();

    const sheet = this.dom.get("sheet");
    const book = this.dom.get("book");

    if (sheet) {
      sheet.dataset.direction = this.direction;
      sheet.dataset.phase = "drag";
      sheet.style.transition = "none";
    }

    if (book) {
      book.dataset.state = "flipping";
    }
  }

  _showUnderPage() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.renderer.elements;
    this._pageRefs = { leftActive, rightActive, leftBuffer, rightBuffer };

    if (this.isMobile) {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = "false";
        rightBuffer.dataset.dragVisible = "true";
      }
      if (rightActive) rightActive.style.display = "none";
    } else if (this.direction === "next") {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = "false";
        rightBuffer.dataset.dragVisible = "true";
      }
      if (rightActive) rightActive.style.display = "none";
    } else {
      if (leftBuffer) {
        leftBuffer.dataset.buffer = "false";
        leftBuffer.dataset.dragVisible = "true";
      }
      if (leftActive) leftActive.style.display = "none";
    }
  }

  // ═══════════════════════════════════════════
  // ДВИЖЕНИЕ
  // ═══════════════════════════════════════════

  _onMouseMove(e) {
    if (!this.isDragging) return;
    this._updateAngleFromEvent(e);
  }

  _onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this._updateAngleFromEvent(e.touches[0]);
  }

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

  _render() {
    const angle = this.direction === "next" ? -this.currentAngle : this.currentAngle;

    const sheet = this.dom.get("sheet");
    if (sheet) {
      sheet.style.transform = `translateZ(1px) rotateY(${angle}deg)`;
    }

    this._updateShadows();
  }

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

    if (this.direction === "next") {
      flipShadow.style.cssText = `
        display: block;
        left: ${spinePosition};
        width: ${flipWidth}px;
        background: linear-gradient(to right, rgba(0,0,0,${flipOpacity}), transparent);
      `;
    } else {
      flipShadow.style.cssText = `
        display: block;
        left: calc(${spinePosition} - ${flipWidth}px);
        width: ${flipWidth}px;
        background: linear-gradient(to left, rgba(0,0,0,${flipOpacity}), transparent);
      `;
    }
  }

  // ═══════════════════════════════════════════
  // ЗАВЕРШЕНИЕ
  // ═══════════════════════════════════════════

  _onMouseUp() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  _onTouchEnd() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  _endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const willComplete = this.currentAngle > 90;
    this._animateTo(willComplete ? 180 : 0, willComplete);
  }

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

  _finish(completed) {
    const direction = this.direction;

    const sheet = this.dom.get("sheet");
    const book = this.dom.get("book");
    const flipShadow = this.dom.get("flipShadow");

    if (sheet) {
      sheet.style.transition = "";
      sheet.style.transform = "";
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }

    if (book) {
      book.style.removeProperty("--spine-shadow-alpha");
      book.style.removeProperty("--spine-shadow-size");
    }

    if (flipShadow) {
      flipShadow.classList.remove("active");
      flipShadow.style.cssText = "";
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

  _cancelFlip() {
    const book = this.dom.get("book");
    this._cleanupAfterFlip(book, false);
  }

  _cleanupAfterFlip(book, completed = false) {
    if (book) book.dataset.state = "opened";

    if (this._pageRefs) {
      const { leftActive, rightActive, leftBuffer, rightBuffer } = this._pageRefs;

      // Восстанавливаем display для скрытых элементов
      if (leftActive) leftActive.style.display = "";
      if (rightActive) rightActive.style.display = "";

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
