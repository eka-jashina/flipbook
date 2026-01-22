/**
 * MEDIA QUERY MANAGER
 * 
 * Реактивное отслеживание media queries.
 */

class MediaQueryManager {
  constructor() {
    this._queries = new Map();
    this._listeners = new Set();
  }

  register(name, query) {
    const mql = window.matchMedia(query);
    this._queries.set(name, mql);

    const handler = () => this._notifyListeners();
    mql.addEventListener("change", handler);

    return () => mql.removeEventListener("change", handler);
  }

  get(name) {
    const mql = this._queries.get(name);
    return mql ? mql.matches : false;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error("MediaQueryManager listener error:", e);
      }
    }
  }

  destroy() {
    this._queries.clear();
    this._listeners.clear();
  }
}

export const mediaQueries = new MediaQueryManager();
mediaQueries.register("mobile", "(max-width: 768px)");

export { MediaQueryManager };
