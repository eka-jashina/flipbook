/**
 * LOADING INDICATOR
 * Управление оверлеем загрузки.
 *
 * Особенности:
 * - Отображение прогресса пагинации
 * - Именованные фазы с локализованными сообщениями
 * - Простой show/hide интерфейс
 */

export class LoadingIndicator {
  /**
   * @param {HTMLElement} overlay - Элемент оверлея загрузки
   * @param {HTMLElement} progressEl - Элемент для отображения текста прогресса
   */
  constructor(overlay, progressEl) {
    this.overlay = overlay;
    this.progressEl = progressEl;
  }

  /**
   * Показать индикатор загрузки
   */
  show() {
    this.overlay.hidden = false;
  }

  /**
   * Скрыть индикатор загрузки
   */
  hide() {
    this.overlay.hidden = true;
  }

  /**
   * Установить произвольный текст прогресса
   * @param {string} text - Текст для отображения
   */
  setProgress(text) {
    this.progressEl.textContent = text;
  }

  /**
   * Установить фазу загрузки с автоматическим текстом
   * @param {string} phase - Имя фазы (sanitize, parse, layout, content, align, chapters, slice, complete)
   * @param {number} progress - Процент выполнения (0-100)
   */
  setPhase(phase, progress) {
    const phases = {
      sanitize: "Подготовка...",
      parse: "Парсинг...",
      layout: "Разметка...",
      content: `Обработка контента: ${progress}%`,
      align: "Выравнивание...",
      chapters: "Анализ глав...",
      slice: `Нарезка страниц: ${Math.round((progress - 75) * 4)}%`,
      complete: "Готово!",
    };

    this.setProgress(phases[phase] || `${progress}%`);
  }
}
