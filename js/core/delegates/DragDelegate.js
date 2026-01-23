/**
 * DRAG DELEGATE
 * Делегат drag-перелистывания.
 * Управляет перелистыванием страниц перетаскиванием за углы.
 */

import { cssVars } from '../../utils/CSSVariables.js';

console.log('🔧 DragDelegate loaded');

export class DragDelegate {
  constructor(controller) {
    this.ctrl = controller;
    
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
    
    console.log('🔧 DragDelegate constructed');
  }

  // === АЛИАСЫ ===
  
  get elements() { return this.ctrl.elements; }
  get renderer() { return this.ctrl.renderer; }
  get state() { return this.ctrl.stateMachine; }
  get isMobile() { return this.ctrl.isMobile; }
  get pagesPerFlip() { return this.ctrl.pagesPerFlip; }

  /** @returns {boolean} Активен ли drag в данный момент */
  get isActive() { return this.isDragging; }

  // === ПУБЛИЧНЫЙ API ===

  /**
   * Привязать события к зонам захвата
   */
  bind() {
    const corners = this.elements.book.querySelectorAll('.corner-zone');
    console.log('🔧 DragDelegate.bind() - found corner zones:', corners.length);
    
    corners.forEach(zone => {
      console.log(' - binding zone:', zone.dataset.dir);
      
      this.ctrl.eventManager.add(zone, 'mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, zone.dataset.dir);
      });
      
      this.ctrl.eventManager.add(zone, 'touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e.touches[0], zone.dataset.dir);
      }, { passive: false });
    });
    
    this.ctrl.eventManager.add(document, 'mousemove', this._boundHandlers.onMouseMove);
    this.ctrl.eventManager.add(document, 'mouseup', this._boundHandlers.onMouseUp);
    this.ctrl.eventManager.add(document, 'touchmove', this._boundHandlers.onTouchMove, { passive: false });
    this.ctrl.eventManager.add(document, 'touchend', this._boundHandlers.onTouchEnd);
    
    console.log('✅ DragDelegate bound');
  }

  // === ПРОВЕРКИ ВОЗМОЖНОСТИ ДЕЙСТВИЯ ===

  /** @returns {boolean} Можно ли листать вперёд */
  canFlipNext() {
    if (!this.state.isOpened) return false;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    return this.ctrl.index + this.pagesPerFlip <= maxIndex;
  }

  /** @returns {boolean} Можно ли листать назад */
  canFlipPrev() {
    if (!this.state.isOpened) return false;
    return this.ctrl.index > 0;
  }

  // === НАЧАЛО DRAG ===

  /**
   * Начать перетаскивание
   * @param {MouseEvent|Touch} e
   * @param {'next'|'prev'} dir
   */
  _startDrag(e, dir) {
    console.log('🎯 _startDrag called:', { dir, isBusy: this.state.isBusy });
    
    if (this.state.isBusy) return;
    
    if (dir === 'next' && !this.canFlipNext()) {
      console.log('⛔ Cannot flip next');
      return;
    }
    if (dir === 'prev' && !this.canFlipPrev()) {
      console.log('⛔ Cannot flip prev');
      return;
    }
    
    console.log('✅ Starting drag');
    
    this.isDragging = true;
    this.direction = dir;
    this.startX = e.clientX;
    this.currentAngle = 0;
    
    this.bookRect = this.elements.book.getBoundingClientRect();
    this.bookWidth = this.bookRect.width;
    
    this._prepareFlip();
    this.elements.flipShadow?.classList.add('active');
    this._updateAngleFromEvent(e);
  }

  /**
   * Подготовить буферы, sheet и страницу под переворотом
   */
  _prepareFlip() {
    const nextIndex = this.direction === 'next' 
      ? this.ctrl.index + this.pagesPerFlip 
      : this.ctrl.index - this.pagesPerFlip;
    
    console.log('[DRAG] _prepareFlip:', { 
      currentIndex: this.ctrl.index, 
      nextIndex, 
      direction: this.direction,
      isMobile: this.isMobile 
    });
    
    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    this.renderer.prepareSheet(this.ctrl.index, nextIndex, this.direction, this.isMobile);
    this._showUnderPage();
    
    this.elements.sheet.dataset.direction = this.direction;
    this.elements.sheet.dataset.phase = 'drag';
    this.elements.sheet.style.transition = 'none';
    this.elements.book.dataset.state = 'flipping';
  }

  /**
   * Показать страницу под переворачиваемой
   */
  _showUnderPage() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.renderer.elements;
    this._pageRefs = { leftActive, rightActive, leftBuffer, rightBuffer };
    
    if (this.isMobile) {
      rightBuffer.dataset.buffer = 'false';
      rightBuffer.dataset.dragVisible = 'true';
      rightActive.style.display = 'none';
    } else if (this.direction === 'next') {
      rightBuffer.dataset.buffer = 'false';
      rightBuffer.dataset.dragVisible = 'true';
      rightActive.style.display = 'none';
    } else {
      leftBuffer.dataset.buffer = 'false';
      leftBuffer.dataset.dragVisible = 'true';
      leftActive.style.display = 'none';
    }
  }

  // === ДВИЖЕНИЕ ===

  _onMouseMove(e) {
    if (!this.isDragging) return;
    this._updateAngleFromEvent(e);
  }

  _onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this._updateAngleFromEvent(e.touches[0]);
  }

  /**
   * Вычислить угол из позиции курсора
   * @param {MouseEvent|Touch} e
   */
  _updateAngleFromEvent(e) {
    const x = e.clientX - this.bookRect.left;
    
    if (this.direction === 'next') {
      const progress = 1 - (x / this.bookWidth);
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    } else {
      const progress = x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    }
    
    this._render();
  }

  /**
   * Отрисовать текущее состояние drag
   */
  _render() {
    const angle = this.direction === 'next' 
      ? -this.currentAngle 
      : this.currentAngle;
    
    this.elements.sheet.style.transform = `translateZ(1px) rotateY(${angle}deg)`;
    this._updateShadows();
  }

  /**
   * Обновить тени (на sheet и flip-shadow на странице)
   */
  _updateShadows() {
    const progress = this.currentAngle / 180;
    const shadowOpacity = Math.sin(progress * Math.PI) * 0.35;
    const shadowSize = Math.sin(progress * Math.PI) * 25;
    
    this.elements.book.style.setProperty('--spine-shadow-alpha', shadowOpacity.toFixed(2));
    this.elements.book.style.setProperty('--spine-shadow-size', `${shadowSize}px`);
    
    // Тень на странице под переворотом
    const { flipShadow } = this.elements;
    if (!flipShadow) return;
    
    const flipOpacity = Math.sin(progress * Math.PI) * 0.4;
    const flipWidth = Math.sin(progress * Math.PI) * 120;
    
    // На мобильном корешок на 10%, на десктопе на 50%
    const spinePosition = this.isMobile ? '10%' : '50%';
    
    if (this.direction === 'next') {
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

  // === ЗАВЕРШЕНИЕ ===

  _onMouseUp() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  _onTouchEnd() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /**
   * Завершить перетаскивание — решить, завершить или отменить
   */
  _endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    const willComplete = this.currentAngle > 90;
    this._animateTo(willComplete ? 180 : 0, willComplete);
  }

  /**
   * Анимировать к целевому углу
   * @param {number} targetAngle
   * @param {boolean} willComplete
   */
  _animateTo(targetAngle, willComplete) {
    const startAngle = this.currentAngle;
    const duration = Math.max(150, 
      cssVars.getTime('--timing-rotate', 350) * 
      Math.abs(targetAngle - startAngle) / 180
    );
    const startTime = performance.now();
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Easing: ease-in-out quad
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
   * Финализировать drag — сбросить состояние и применить результат
   * @param {boolean} completed
   */
  _finish(completed) {
    const direction = this.direction;
    
    // Reset sheet
    this.elements.sheet.style.transition = '';
    this.elements.sheet.style.transform = '';
    delete this.elements.sheet.dataset.phase;
    delete this.elements.sheet.dataset.direction;
    
    // Reset shadows
    this.elements.book.style.removeProperty('--spine-shadow-alpha');
    this.elements.book.style.removeProperty('--spine-shadow-size');
    
    if (this.elements.flipShadow) {
      this.elements.flipShadow.classList.remove('active');
      this.elements.flipShadow.style.cssText = '';
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
   * Завершить переворот успешно — обновить индекс и поменять буферы
   * @param {'next'|'prev'} direction
   */
  _completeFlip(direction) {
    this.elements.book.dataset.noTransition = 'true';
    
    this.ctrl.index = direction === 'next'
      ? this.ctrl.index + this.pagesPerFlip
      : this.ctrl.index - this.pagesPerFlip;
    
    this.renderer.swapBuffers();
    this._hideUnderPage(true);
    
    this.elements.book.dataset.state = 'opened';
    
    // Включаем transitions обратно после отрисовки
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        delete this.elements.book.dataset.noTransition;
      });
    });
    
    this.ctrl.settings.set("page", this.ctrl.index);
    this.ctrl.chapterDelegate.updateChapterUI();
    this.ctrl._updateDebug();
  }

  /**
   * Отменить переворот — вернуть всё как было
   */
  _cancelFlip() {
    this._hideUnderPage(false);
    this.elements.book.dataset.state = 'opened';
    this.ctrl._updateDebug();
  }

  /**
   * Скрыть страницу под переворачиваемой
   * @param {boolean} completed - true если переворот завершён
   */
  _hideUnderPage(completed) {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this._pageRefs || this.renderer.elements;
    
    delete leftBuffer.dataset.dragVisible;
    delete rightBuffer.dataset.dragVisible;
    leftActive.style.display = '';
    rightActive.style.display = '';
    
    // При отмене возвращаем буферы в скрытое состояние
    if (!completed) {
      leftBuffer.dataset.buffer = 'true';
      rightBuffer.dataset.buffer = 'true';
    }
  }

  /**
   * Очистка при уничтожении
   */
  destroy() {
    this._boundHandlers = {};
    this._pageRefs = null;
  }
}