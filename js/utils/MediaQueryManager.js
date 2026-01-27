/**
 * MEDIA QUERY MANAGER
 * Реактивное отслеживание media queries.
 *
 * Особенности:
 * - Именованные media queries для удобства доступа
 * - Автоматическое уведомление подписчиков при изменении
 * - Паттерн Observer для реактивности
 * - Глобальный синглтон с предустановкой "mobile"
 */

class MediaQueryManager {
  constructor() {
    /** @type {Map<string, MediaQueryList>} Зарегистрированные запросы */
    this._queries = new Map();
    /** @type {Set<Function>} Подписчики на изменения */
    this._listeners = new Set();
  }

  /**
   * Зарегистрировать media query под именем
   * @param {string} name - Уникальное имя запроса (например, 'mobile')
   * @param {string} query - CSS media query (например, '(max-width: 768px)')
   * @returns {Function} Функция для отписки от события change
   */
  register(name, query) {
    const mql = window.matchMedia(query);
    this._queries.set(name, mql);

    const handler = () => this._notifyListeners();
    mql.addEventListener("change", handler);

    return () => mql.removeEventListener("change", handler);
  }

  /**
   * Проверить текущее состояние media query
   * @param {string} name - Имя зарегистрированного запроса
   * @returns {boolean} true если media query активен
   */
  get(name) {
    const mql = this._queries.get(name);
    return mql ? mql.matches : false;
  }

  /**
   * Подписаться на изменения любого media query
   * @param {Function} listener - Функция-обработчик
   * @returns {Function} Функция отписки
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Уведомить всех подписчиков об изменении
   * @private
   */
  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error("MediaQueryManager listener error:", e);
      }
    }
  }

  /**
   * Очистить все запросы и подписчиков
   */
  destroy() {
    this._queries.clear();
    this._listeners.clear();
  }
}

export const mediaQueries = new MediaQueryManager();
mediaQueries.register("mobile", "(max-width: 768px)");

export { MediaQueryManager };
