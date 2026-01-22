/**
 * DRAG CONTROLLER
 * Управление перелистыванием страниц перетаскиванием за углы.
 */

import { cssVars } from '../utils/CSSVariables.js';

export class DragController {
  constructor(options) {
    this.book = options.book;
    this.sheet = options.sheet;
    this.eventManager = options.eventManager;
    
    // Callbacks
    this.onDragStart = options.onDragStart; // (direction) => void
    this.onDragEnd = options.onDragEnd; // (completed, direction) => void
    this.canFlipNext = options.canFlipNext; // () => boolean
    this.canFlipPrev = options.canFlipPrev; // () => boolean
    this.isBusy = options.isBusy; // () => boolean
    
    // State
    this.isDragging = false;
    this.direction = null;
    this.currentAngle = 0;
    this.startX = 0;
    
    // Cached dimensions
    this.bookWidth = 0;
    this.bookRect = null;
    
    this._boundHandlers = {
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onTouchMove: this._onTouchMove.bind(this),
      onTouchEnd: this._onTouchEnd.bind(this),
    };
  }

  /**
   * Привязать события к зонам захвата
   */
  bind() {
    const corners = this.book.querySelectorAll('.corner-zone');
    
    corners.forEach(zone => {
      this.eventManager.add(zone, 'mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, zone.dataset.dir);
      });
      
      this.eventManager.add(zone, 'touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e.touches[0], zone.dataset.dir);
      }, { passive: false });
    });
    
    // Global listeners для отслеживания движения
    this.eventManager.add(document, 'mousemove', this._boundHandlers.onMouseMove);
    this.eventManager.add(document, 'mouseup', this._boundHandlers.onMouseUp);
    this.eventManager.add(document, 'touchmove', this._boundHandlers.onTouchMove, { passive: false });
    this.eventManager.add(document, 'touchend', this._boundHandlers.onTouchEnd);
  }

  /**
   * Начать перетаскивание
   */
  _startDrag(e, dir) {
    if (this.isBusy()) return;
    
    // Проверяем возможность переворота
    if (dir === 'next' && !this.canFlipNext()) return;
    if (dir === 'prev' && !this.canFlipPrev()) return;
    
    this.isDragging = true;
    this.direction = dir;
    this.startX = e.clientX;
    this.currentAngle = 0;
    
    // Кэшируем размеры
    this.bookRect = this.book.getBoundingClientRect();
    this.bookWidth = this.bookRect.width;
    
    // Уведомляем о начале drag
    this.onDragStart?.(dir);
    
    // Инициализируем sheet для drag-режима
    this._initSheetForDrag();
    
    // Обновляем угол из текущей позиции
    this._updateAngleFromEvent(e);
  }

  /**
   * Инициализация sheet для drag-режима
   */
  _initSheetForDrag() {
    this.sheet.dataset.direction = this.direction;
    this.sheet.dataset.phase = 'drag';
    this.sheet.style.transition = 'none';
  }

  /**
   * Обработка движения мыши
   */
  _onMouseMove(e) {
    if (!this.isDragging) return;
    this._updateAngleFromEvent(e);
  }

  /**
   * Обработка движения touch
   */
  _onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this._updateAngleFromEvent(e.touches[0]);
  }

  /**
   * Вычислить угол из позиции курсора
   */
  _updateAngleFromEvent(e) {
    const x = e.clientX - this.bookRect.left;
    
    if (this.direction === 'next') {
      // Справа налево: x от bookWidth до 0 => angle от 0 до 180
      const progress = 1 - (x / this.bookWidth);
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    } else {
      // Слева направо: x от 0 до bookWidth => angle от 0 до 180
      const progress = x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    }
    
    this._renderDrag();
  }

  /**
   * Отрисовать текущее состояние drag
   */
  _renderDrag() {
    let angle;
    
    if (this.direction === 'next') {
      // Правая страница поворачивается влево (от 0 до -180)
      angle = -this.currentAngle;
    } else {
      // Левая страница поворачивается вправо (от 0 до 180)
      angle = this.currentAngle;
    }
    
    this.sheet.style.transform = `translateZ(1px) rotateY(${angle}deg)`;
    
    // Динамические тени
    this._updateShadows();
  }

  /**
   * Обновить динамические тени
   */
  _updateShadows() {
    const progress = this.currentAngle / 180;
    const shadowOpacity = Math.sin(progress * Math.PI) * 0.35;
    const shadowSize = Math.sin(progress * Math.PI) * 25;
    
    // Обновляем CSS переменные для теней
    this.book.style.setProperty('--spine-shadow-alpha', shadowOpacity.toFixed(2));
    this.book.style.setProperty('--spine-shadow-size', `${shadowSize}px`);
  }

  /**
   * Завершение drag мышью
   */
  _onMouseUp() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /**
   * Завершение drag touch
   */
  _onTouchEnd() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /**
   * Завершить перетаскивание
   */
  _endDrag() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // Решаем: завершить переворот или отменить
    const willComplete = this.currentAngle > 90;
    const targetAngle = willComplete ? 180 : 0;
    
    // Анимируем к целевому углу
    this._animateTo(targetAngle, willComplete);
  }

  /**
   * Анимировать к целевому углу
   */
  _animateTo(targetAngle, willComplete) {
    const startAngle = this.currentAngle;
    const duration = Math.max(150, 
      cssVars.getTime('--timing-rotate', 350) * 
      Math.abs(targetAngle - startAngle) / 180
    );
    const startTime = performance.now();
    const direction = this.direction;
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Easing: ease-in-out quad
      const eased = t < 0.5 
        ? 2 * t * t 
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      this.currentAngle = startAngle + (targetAngle - startAngle) * eased;
      this._renderDrag();
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this._finishDrag(willComplete, direction);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Завершить drag и очистить состояние
   */
  _finishDrag(completed, direction) {
    // Сбрасываем стили sheet
    this.sheet.style.transition = '';
    this.sheet.style.transform = '';
    delete this.sheet.dataset.phase;
    delete this.sheet.dataset.direction;
    
    // Сбрасываем тени
    this.book.style.removeProperty('--spine-shadow-alpha');
    this.book.style.removeProperty('--spine-shadow-size');
    
    // Уведомляем о завершении
    this.onDragEnd?.(completed, direction);
    
    this.direction = null;
    this.currentAngle = 0;
  }

  /**
   * Проверка активности drag
   */
  get isActive() {
    return this.isDragging;
  }

  destroy() {
    this._boundHandlers = {};
  }
}