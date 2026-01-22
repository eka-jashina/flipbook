/**
 * CSS VARIABLES READER
 * 
 * Кэшированное чтение CSS custom properties.
 */

class CSSVariables {
  constructor(element = document.documentElement) {
    this.element = element;
    this._cache = new Map();
    this._computedStyle = null;
  }

  get computedStyle() {
    if (!this._computedStyle) {
      this._computedStyle = getComputedStyle(this.element);
    }
    return this._computedStyle;
  }

  invalidateCache() {
    this._cache.clear();
    this._computedStyle = null;
  }

  get(name, fallback = null) {
    if (this._cache.has(name)) {
      return this._cache.get(name);
    }
    const value = this.computedStyle.getPropertyValue(name).trim();
    const result = value || fallback;
    this._cache.set(name, result);
    return result;
  }

  getNumber(name, fallback = 0) {
    const value = this.get(name);
    if (!value) return fallback;
    return parseFloat(value) || fallback;
  }

  getTime(name, fallback = 0) {
    const value = this.get(name);
    if (!value) return fallback;
    if (value.endsWith("ms")) return parseFloat(value) || fallback;
    if (value.endsWith("s")) return (parseFloat(value) || 0) * 1000;
    return parseFloat(value) || fallback;
  }
}

export const cssVars = new CSSVariables();
export { CSSVariables };
