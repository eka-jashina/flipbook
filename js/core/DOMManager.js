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
      // Корневые элементы
      html: document.documentElement,
      body: document.body,

      // Структура книги
      book: $("book"),
      bookWrap: $("book-wrap"),
      cover: $("cover"),

      // Страницы (активный буфер)
      leftA: $("leftA"),
      rightA: $("rightA"),

      // Страницы (вторичный буфер)
      leftB: $("leftB"),
      rightB: $("rightB"),

      // Анимированный лист
      sheet: $("sheet"),
      sheetFront: $("sheetFront"),
      sheetBack: $("sheetBack"),

      // Эффекты
      flipShadow: $("flipShadow"),

      // Загрузка
      loadingOverlay: $("loadingOverlay"),
      loadingProgress: $("loadingProgress"),

      // Элементы навигации (Navigation Pod)
      nextBtn: $("next"),
      prevBtn: $("prev"),
      tocBtn: $("tocBtn"),
      continueBtn: $("continueBtn"),
      currentPage: $("current-page"),
      totalPages: $("total-pages"),
      readingProgress: $("reading-progress"),

      // Элементы настроек (Settings Pod)
      increaseBtn: $("increase"),
      decreaseBtn: $("decrease"),
      fontSizeValue: $("font-size-value"),
      fontSelect: $("font-select"),
      themeSegmented: document.querySelector(".theme-segmented"),
      debugToggle: $("debugToggle"),

      // Элементы звука (Audio Pod)
      soundToggle: $("sound-toggle"),
      volumeSlider: $("volume-slider"),
      pageVolumeControl: $("page-volume-control"),

      // Элементы ambient (кнопки-таблетки)
      ambientPills: document.querySelector(".ambient-pills"),
      ambientVolume: $("ambient-volume"),
      ambientVolumeWrapper: $("ambient-volume-wrapper"),

      // Чекбокс настроек (fallback для Safari без :has())
      settingsCheckbox: $("settings-checkbox"),

      // Полноэкранный режим
      fullscreenBtn: $("fullscreen-btn"),

      // Панель отладки
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
