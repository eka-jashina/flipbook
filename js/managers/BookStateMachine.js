/**
 * BOOK STATE MACHINE
 * Конечный автомат для управления состоянием книги.
 *
 * Граф переходов:
 * ```
 * CLOSED → OPENING → OPENED ⇄ FLIPPING
 *                         ↓
 *                      CLOSING → CLOSED
 * ```
 *
 * Гарантирует валидность переходов между состояниями.
 * Невалидные переходы игнорируются с предупреждением в консоль.
 *
 * @example
 * const fsm = new BookStateMachine();
 * fsm.subscribe((newState, oldState) => {
 *   console.log(`${oldState} → ${newState}`);
 * });
 *
 * fsm.transitionTo(BookState.OPENING); // true
 * fsm.transitionTo(BookState.FLIPPING); // false (невалидный переход)
 */

import { BookState } from '../config.js';

/**
 * @typedef {Function} StateListener
 * @param {string} newState - Новое состояние
 * @param {string} oldState - Предыдущее состояние
 */

export class BookStateMachine {
  /**
   * Создаёт конечный автомат состояний книги
   * @param {string} [initialState=BookState.CLOSED] - Начальное состояние
   */
  constructor(initialState = BookState.CLOSED) {
    /** @type {string} Текущее состояние */
    this._state = initialState;

    /** @type {Set<StateListener>} Подписчики на изменения состояния */
    this._listeners = new Set();

    /**
     * Граф допустимых переходов: состояние → множество разрешённых целевых состояний
     * @type {Map<string, Set<string>>}
     * @private
     */
    this._transitions = new Map([
      [BookState.CLOSED, new Set([BookState.OPENING])],
      [BookState.OPENING, new Set([BookState.OPENED])],
      [BookState.OPENED, new Set([BookState.FLIPPING, BookState.CLOSING])],
      [BookState.FLIPPING, new Set([BookState.OPENED])],
      [BookState.CLOSING, new Set([BookState.CLOSED])],
    ]);
  }

  /**
   * Текущее состояние
   * @returns {string}
   */
  get state() { return this._state; }

  /**
   * Книга закрыта
   * @returns {boolean}
   */
  get isClosed() { return this._state === BookState.CLOSED; }

  /**
   * Книга открывается (анимация)
   * @returns {boolean}
   */
  get isOpening() { return this._state === BookState.OPENING; }

  /**
   * Книга открыта и готова к взаимодействию
   * @returns {boolean}
   */
  get isOpened() { return this._state === BookState.OPENED; }

  /**
   * Страница перелистывается (анимация)
   * @returns {boolean}
   */
  get isFlipping() { return this._state === BookState.FLIPPING; }

  /**
   * Книга закрывается (анимация)
   * @returns {boolean}
   */
  get isClosing() { return this._state === BookState.CLOSING; }

  /**
   * Книга занята анимацией (opening/flipping/closing)
   *
   * Используется для блокировки пользовательского ввода во время анимаций.
   * @returns {boolean}
   */
  get isBusy() {
    return this._state === BookState.OPENING ||
           this._state === BookState.FLIPPING ||
           this._state === BookState.CLOSING;
  }

  /**
   * Проверить возможность перехода в указанное состояние
   *
   * @param {string} newState - Целевое состояние
   * @returns {boolean} true, если переход разрешён
   */
  canTransitionTo(newState) {
    const allowed = this._transitions.get(this._state);
    return allowed ? allowed.has(newState) : false;
  }

  /**
   * Выполнить переход в новое состояние
   *
   * При успешном переходе уведомляет всех подписчиков.
   * Ошибки в подписчиках логируются, но не прерывают уведомление остальных.
   *
   * @param {string} newState - Целевое состояние
   * @returns {boolean} true, если переход выполнен; false, если невалидный
   */
  transitionTo(newState) {
    if (!this.canTransitionTo(newState)) {
      console.warn(`Invalid state transition: ${this._state} → ${newState}`);
      return false;
    }

    const oldState = this._state;
    this._state = newState;

    for (const listener of this._listeners) {
      try {
        listener(newState, oldState);
      } catch (e) {
        console.error("State listener error:", e);
      }
    }
    return true;
  }

  /**
   * Подписаться на изменения состояния
   *
   * @param {StateListener} listener - Функция-обработчик (newState, oldState)
   * @returns {Function} Функция отписки
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Принудительно установить состояние (без валидации)
   *
   * Используется для инициализации или восстановления состояния.
   * Не вызывает уведомление подписчиков.
   *
   * @param {string} [state=BookState.CLOSED] - Состояние для установки
   */
  reset(state = BookState.CLOSED) {
    this._state = state;
  }

  /**
   * Очистить все подписки
   */
  destroy() {
    this._listeners.clear();
  }
}
