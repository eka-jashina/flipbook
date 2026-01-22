/**
 * BOOK STATE MACHINE
 * Конечный автомат для управления состоянием книги.
 * 
 * Граф переходов:
 * CLOSED → OPENING → OPENED ⇄ FLIPPING
 *                         ↓
 *                      CLOSING → CLOSED
 */

import { BookState } from '../config.js';

export class BookStateMachine {
  constructor(initialState = BookState.CLOSED) {
    this._state = initialState;
    this._listeners = new Set();
    
    this._transitions = new Map([
      [BookState.CLOSED, new Set([BookState.OPENING])],
      [BookState.OPENING, new Set([BookState.OPENED])],
      [BookState.OPENED, new Set([BookState.FLIPPING, BookState.CLOSING])],
      [BookState.FLIPPING, new Set([BookState.OPENED])],
      [BookState.CLOSING, new Set([BookState.CLOSED])],
    ]);
  }

  get state() { return this._state; }
  get isClosed() { return this._state === BookState.CLOSED; }
  get isOpening() { return this._state === BookState.OPENING; }
  get isOpened() { return this._state === BookState.OPENED; }
  get isFlipping() { return this._state === BookState.FLIPPING; }
  get isClosing() { return this._state === BookState.CLOSING; }
  
  get isBusy() {
    return this._state === BookState.OPENING ||
           this._state === BookState.FLIPPING ||
           this._state === BookState.CLOSING;
  }

  canTransitionTo(newState) {
    const allowed = this._transitions.get(this._state);
    return allowed ? allowed.has(newState) : false;
  }

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

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  reset(state = BookState.CLOSED) {
    this._state = state;
  }

  destroy() {
    this._listeners.clear();
  }
}
