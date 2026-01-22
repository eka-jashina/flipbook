/**
 * EVENT LISTENER MANAGER
 * Централизованное управление DOM event listeners.
 */

export class EventListenerManager {
  constructor() {
    this.listeners = new Map();
    this.listenerCount = 0;
  }

  /**
   * Добавить event listener
   */
  add(element, eventType, handler, options = {}) {
    if (!element) return;
    element.addEventListener(eventType, handler, options);

    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }
    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(eventType)) {
      elementListeners.set(eventType, new Set());
    }
    elementListeners.get(eventType).add({ handler, options });
    this.listenerCount++;
  }

  /**
   * Удалить конкретный listener
   */
  remove(element, eventType, handler) {
    if (!element) return;
    element.removeEventListener(eventType, handler);

    const elementListeners = this.listeners.get(element);
    if (elementListeners?.has(eventType)) {
      const handlers = elementListeners.get(eventType);
      for (const item of handlers) {
        if (item.handler === handler) {
          handlers.delete(item);
          this.listenerCount--;
          break;
        }
      }
    }
  }

  /**
   * Удалить все listeners
   */
  clear() {
    for (const [element, eventMap] of this.listeners) {
      for (const [eventType, handlers] of eventMap) {
        for (const { handler, options } of handlers) {
          element.removeEventListener(eventType, handler, options);
        }
      }
    }
    this.listeners.clear();
    this.listenerCount = 0;
  }

  get count() {
    return this.listenerCount;
  }
}
