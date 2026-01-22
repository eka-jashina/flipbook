/**
 * EVENT EMITTER
 * Простая реализация паттерна Observer/PubSub.
 */

export class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  /**
   * Подписаться на событие
   * @param {string} event - Имя события
   * @param {Function} handler - Обработчик
   * @returns {Function} Функция отписки
   */
  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Отписаться от события
   */
  off(event, handler) {
    const handlers = this._events.get(event);
    if (handlers) handlers.delete(handler);
  }

  /**
   * Вызвать событие
   */
  emit(event, ...args) {
    const handlers = this._events.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (e) {
          console.error(`EventEmitter error for "${event}":`, e);
        }
      }
    }
  }

  destroy() {
    this._events.clear();
  }
}
