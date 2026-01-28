/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью и событиями.
 *
 * Особенности:
 * - Автоматическое сохранение в localStorage
 * - Событийная модель (change, change:key)
 * - Слияние defaults с сохранёнными настройками
 * - Предотвращение лишних событий при одинаковых значениях
 */

import { EventEmitter } from '../utils/EventEmitter.js';

export class SettingsManager extends EventEmitter {
  /**
   * @param {StorageManager} storage - Менеджер хранилища
   * @param {Object} defaults - Значения по умолчанию
   */
  constructor(storage, defaults) {
    super();
    this.storage = storage;
    // Сохранённые настройки перезаписывают defaults
    this.settings = { ...defaults, ...storage.load() };
  }

  /**
   * Получить значение настройки
   * @param {string} key - Ключ настройки
   * @returns {*} Значение настройки
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Установить значение настройки
   * Автоматически сохраняет в storage и эмитит события
   * @param {string} key - Ключ настройки
   * @param {*} value - Новое значение
   */
  set(key, value) {
    const oldValue = this.settings[key];
    // Не делаем ничего если значение не изменилось
    if (oldValue === value) return;

    this.settings[key] = value;
    this.storage.save({ [key]: value });

    // Эмитим общее событие и событие для конкретного ключа
    this.emit("change", { key, value, oldValue });
    this.emit(`change:${key}`, { value, oldValue });
  }
}
