/**
 * BASE DELEGATE
 * Базовый класс для всех делегатов с общими зависимостями.
 * 
 * @abstract
 */

export class BaseDelegate {
  /**
   * @param {Object} deps - Объект зависимостей
   */
  constructor(deps) {
    this._validateRequiredDependencies(deps);
    this._deps = deps;
  }

  /**
   * Валидация обязательных зависимостей
   * Переопределяется в дочерних классах
   * @protected
   * @param {Object} deps
   */
  _validateRequiredDependencies(deps) {
    // Базовая валидация - переопределяется в наследниках
  }

  /**
   * Валидация списка зависимостей
   * @protected
   * @param {Object} deps - Объект зависимостей
   * @param {string[]} required - Список обязательных ключей
   * @param {string} className - Имя класса для сообщения об ошибке
   */
  _validateDependencies(deps, required, className) {
    const missing = required.filter(key => !deps[key]);
    
    if (missing.length > 0) {
      throw new Error(
        `${className}: Missing required dependencies: ${missing.join(', ')}`
      );
    }
  }

  // ═══════════════════════════════════════════
  // ОБЩИЕ ГЕТТЕРЫ ДЛЯ ВСЕХ ДЕЛЕГАТОВ
  // ═══════════════════════════════════════════

  /** @returns {BookStateMachine|undefined} */
  get stateMachine() {
    return this._deps.stateMachine;
  }

  /** @returns {BookRenderer|undefined} */
  get renderer() {
    return this._deps.renderer;
  }

  /** @returns {BookAnimator|undefined} */
  get animator() {
    return this._deps.animator;
  }

  /** @returns {SettingsManager|undefined} */
  get settings() {
    return this._deps.settings;
  }

  /** @returns {SoundManager|undefined} */
  get soundManager() {
    return this._deps.soundManager;
  }

  /** @returns {AmbientManager|undefined} */
  get ambientManager() {
    return this._deps.ambientManager;
  }

  /** @returns {MediaQueryManager|undefined} */
  get mediaQueries() {
    return this._deps.mediaQueries;
  }

  /** @returns {DOMManager|undefined} */
  get dom() {
    return this._deps.dom;
  }

  /** @returns {BackgroundManager|undefined} */
  get backgroundManager() {
    return this._deps.backgroundManager;
  }

  /** @returns {Object|undefined} Общее состояние контроллера */
  get state() {
    return this._deps.state;
  }

  // ═══════════════════════════════════════════
  // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
  // ═══════════════════════════════════════════

  /** @returns {boolean} Мобильный ли режим */
  get isMobile() {
    return this.mediaQueries?.get("mobile") ?? false;
  }

  /** @returns {number} Текущий индекс страницы */
  get currentIndex() {
    return this.state?.index ?? 0;
  }

  /** @returns {number[]} Индексы начала глав */
  get chapterStarts() {
    return this.state?.chapterStarts ?? [];
  }

  /** @returns {boolean} Открыта ли книга */
  get isOpened() {
    return this.stateMachine?.isOpened ?? false;
  }

  /** @returns {boolean} Занят ли state machine */
  get isBusy() {
    return this.stateMachine?.isBusy ?? false;
  }

  // ═══════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════

  /**
   * Очистка ресурсов
   * Переопределяется в дочерних классах при необходимости
   */
  destroy() {
    this._deps = null;
  }
}
