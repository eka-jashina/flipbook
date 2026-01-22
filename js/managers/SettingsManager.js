/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью и событиями.
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class SettingsManager extends EventEmitter {
  constructor(storage, defaults) {
    super();
    this.storage = storage;
    this.settings = { ...defaults, ...storage.load() };
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    const oldValue = this.settings[key];
    if (oldValue === value) return;

    this.settings[key] = value;
    this.storage.save({ [key]: value });
    
    this.emit("change", { key, value, oldValue });
    this.emit(`change:${key}`, { value, oldValue });
  }

  getAll() {
    return { ...this.settings };
  }
}
