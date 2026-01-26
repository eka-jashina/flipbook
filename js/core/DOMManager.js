/**
 * DOM MANAGER
 * Централизованное кэширование и управление DOM элементами.
 * 
 * Преимущества:
 * - Единая точка доступа к элементам
 * - Проверка существования элементов при старте
 * - Типобезопасность (через JSDoc)
 */

export class DOMManager {
  constructor() {
    this.elements = this._cacheElements();
    this._validateElements();
  }

  /**
   * Кэширование всех DOM элементов
   * @private
   * @returns {Object} Объект с элементами
   */
  _cacheElements() {
    const $ = id => document.getElementById(id);
    
    return {
      // Root elements
      html: document.documentElement,
      body: document.body,
      
      // Book structure
      book: $("book"),
      bookWrap: $("book-wrap"),
      cover: $("cover"),
      
      // Pages (active buffer)
      leftA: $("leftA"),
      rightA: $("rightA"),
      
      // Pages (secondary buffer)
      leftB: $("leftB"),
      rightB: $("rightB"),
      
      // Animated sheet
      sheet: $("sheet"),
      sheetFront: $("sheetFront"),
      sheetBack: $("sheetBack"),
      
      // Effects
      flipShadow: $("flipShadow"),
      
      // Loading
      loadingOverlay: $("loadingOverlay"),
      loadingProgress: $("loadingProgress"),
      
      // Navigation controls
      nextBtn: $("next"),
      prevBtn: $("prev"),
      tocBtn: $("tocBtn"),
      continueBtn: $("continueBtn"),
      
      // Settings controls
      increaseBtn: $("increase"),
      decreaseBtn: $("decrease"),
      fontSelect: $("font-select"),
      themeSelect: $("theme-select"),
      debugToggle: $("debugToggle"),

      // Sound controls
      soundToggle: $("sound-toggle"),
      volumeSlider: $("volume-slider"),
      volumeDown: $("volume-down"),
      volumeUp: $("volume-up"),

      // Ambient controls
      ambientSelect: $("ambient-select"),
      ambientVolume: $("ambient-volume"),
      ambientVolumeLabel: $("ambient-volume-label"),
      ambientVolumeWrapper: $("ambient-volume-wrapper"),
      
      // Debug panel
      debugInfo: $("debugInfo"),
      debugState: $("debugState"),
      debugTotal: $("debugTotal"),
      debugCurrent: $("debugCurrent"),
      debugCache: $("debugCache"),
      debugMemory: $("debugMemory"),
      debugListeners: $("debugListeners"),
    };
  }

  /**
   * Проверка критичных элементов
   * @private
   */
  _validateElements() {
    const critical = [
      'book', 'bookWrap', 'leftA', 'rightA', 
      'sheet', 'sheetFront', 'sheetBack'
    ];
    
    const missing = critical.filter(key => !this.elements[key]);
    
    if (missing.length > 0) {
      throw new Error(`Critical DOM elements missing: ${missing.join(', ')}`);
    }
  }

  /**
   * Получить элемент по ключу
   * @param {string} key
   * @returns {HTMLElement|null}
   */
  get(key) {
    return this.elements[key] || null;
  }

  /**
   * Получить несколько элементов
   * @param {...string} keys
   * @returns {Object}
   */
  getMultiple(...keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.elements[key];
    }
    return result;
  }

  /**
   * Очистить содержимое страниц
   */
  clearPages() {
    const pageIds = ['leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack'];
    pageIds.forEach(id => {
      const el = this.elements[id];
      if (el) el.innerHTML = "";
    });
  }
}
