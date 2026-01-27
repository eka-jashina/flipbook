/**
 * DEBUG PANEL
 * Панель отладки для отображения внутреннего состояния.
 */

export class DebugPanel {
  constructor(elements) {
    this.container = elements.container;
    this.elements = elements;
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
    this.container.classList.toggle("visible", this.visible);
    
    // Включаем/выключаем debug режим для drag-зон
    document.body.dataset.debug = this.visible;
  }

  update(data) {
    if (!this.visible) return;

    this.elements.state.textContent = data.state;
    this.elements.total.textContent = data.totalPages;
    this.elements.current.textContent = data.currentPage;
    this.elements.cache.textContent = `${data.cacheSize}/${data.cacheLimit}`;
    this.elements.listeners.textContent = data.listenerCount;

    if (performance.memory) {
      const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
      this.elements.memory.textContent = `${mb} MB`;
    }
  }
}

/**
 * ИСПОЛЬЗОВАНИЕ:
 * 
 * При включении debug режима (Ctrl+D):
 * - Панель отладки становится видимой
 * - Зоны drag подсвечиваются красным с анимацией
 * - Показываются метки направлений (next/prev)
 * 
 * Это помогает:
 * - Визуально проверить расположение зон
 * - Отладить взаимодействие
 * - Понять механику drag-перелистывания
 */
