/**
 * DRAG SHADOW RENDERER
 * Рендеринг теней при drag-перелистывании.
 *
 * Отвечает за:
 * - Тень на корешке книги (spine shadow)
 * - Тень от переворачиваемой страницы (flip shadow)
 * - Расчёт интенсивности теней по углу поворота
 */

export class DragShadowRenderer {
  /**
   * @param {DOMManager} dom - Менеджер DOM-элементов
   */
  constructor(dom) {
    this.dom = dom;
  }

  /**
   * Активировать flip shadow
   * @param {string} direction - Направление: 'next' или 'prev'
   */
  activate(direction) {
    const flipShadow = this.dom.get("flipShadow");
    if (flipShadow) {
      flipShadow.classList.add("active");
      flipShadow.dataset.direction = direction;
    }
  }

  /**
   * Обновить тени по текущему углу поворота.
   * Интенсивность максимальна при 90° (sin(π/2) = 1).
   * @param {number} angle - Текущий угол (0-180)
   * @param {string} direction - Направление: 'next' или 'prev'
   * @param {boolean} isMobile - Мобильный режим
   */
  update(angle, direction, isMobile) {
    const progress = angle / 180;

    this._updateSpineShadow(progress);
    this._updateFlipShadow(progress, direction, isMobile);
  }

  /**
   * Очистить все тени и сбросить состояние
   */
  reset() {
    const book = this.dom.get("book");
    const flipShadow = this.dom.get("flipShadow");

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
  }

  /**
   * Обновить тень на корешке книги
   * @private
   * @param {number} progress - Прогресс (0-1)
   */
  _updateSpineShadow(progress) {
    const book = this.dom.get("book");
    if (!book) return;

    const shadowOpacity = Math.sin(progress * Math.PI) * 0.35;
    const shadowSize = Math.sin(progress * Math.PI) * 25;

    book.style.setProperty("--spine-shadow-alpha", shadowOpacity.toFixed(2));
    book.style.setProperty("--spine-shadow-size", `${shadowSize}px`);
  }

  /**
   * Обновить тень от переворачиваемой страницы
   * @private
   * @param {number} progress - Прогресс (0-1)
   * @param {string} direction - Направление
   * @param {boolean} isMobile - Мобильный режим
   */
  _updateFlipShadow(progress, direction, isMobile) {
    const flipShadow = this.dom.get("flipShadow");
    if (!flipShadow) return;

    const flipOpacity = Math.sin(progress * Math.PI) * 0.4;
    const flipWidth = Math.sin(progress * Math.PI) * 120;
    const spinePosition = isMobile ? "10%" : "50%";

    const leftPosition = direction === "next"
      ? spinePosition
      : `calc(${spinePosition} - ${flipWidth}px)`;

    flipShadow.style.setProperty("--flip-shadow-opacity", flipOpacity.toFixed(2));
    flipShadow.style.setProperty("--flip-shadow-width", `${flipWidth}px`);
    flipShadow.style.setProperty("--flip-shadow-left", leftPosition);
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.reset();
    this.dom = null;
  }
}
