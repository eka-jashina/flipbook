/**
 * LOADING INDICATOR
 * Управление оверлеем загрузки.
 */

export class LoadingIndicator {
  constructor(overlay, progressEl) {
    this.overlay = overlay;
    this.progressEl = progressEl;
  }

  show() {
    this.overlay.hidden = false;
  }

  hide() {
    this.overlay.hidden = true;
  }

  setProgress(text) {
    this.progressEl.textContent = text;
  }

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
