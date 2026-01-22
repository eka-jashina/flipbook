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
