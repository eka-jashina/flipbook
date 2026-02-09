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
    // Тени ставятся на sheet (а не book!) чтобы не тригерить
    // style recalc на всём DOM книги при каждом кадре drag
    const sheet = this.dom?.get("sheet");
    const flipShadow = this.dom?.get("flipShadow");

    if (sheet) {
      sheet.style.removeProperty("--spine-shadow-opacity");
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
   * Обновить тень на корешке книги.
   *
   * Производительность: управляем только opacity (compositing-only),
   * без изменения width, gradient-color или blur. CSS ::after использует
   * фиксированные размеры/blur и переменную --spine-shadow-opacity.
   *
   * @private
   * @param {number} progress - Прогресс (0-1)
   */
  _updateSpineShadow(progress) {
    const sheet = this.dom.get("sheet");
    if (!sheet) return;

    // sin(π*progress) даёт 0→1→0 кривую с максимумом при 90° (progress=0.5)
    const opacity = Math.sin(progress * Math.PI);

    sheet.style.setProperty("--spine-shadow-opacity", opacity.toFixed(3));
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
