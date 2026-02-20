/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью.
 *
 * Особенности:
 * - Автоматическое сохранение в localStorage
 * - Слияние defaults с сохранёнными настройками
 * - Предотвращение лишних сохранений при одинаковых значениях
 * - Валидация значений перед сохранением (защита от невалидных данных в localStorage)
 */

import { sanitizeSettings, sanitizeSetting } from '../utils/SettingsValidator.js';

export class SettingsManager {
  /**
   * @param {StorageManager} storage - Менеджер хранилища
   * @param {Object} defaults - Значения по умолчанию
   */
  constructor(storage, defaults = {}) {
    this.storage = storage;
    this._defaults = defaults;
    // Сохранённые настройки перезаписывают defaults,
    // затем санитизируются для защиты от повреждённых данных в localStorage
    const merged = { ...defaults, ...storage.load() };
    this.settings = sanitizeSettings(merged, defaults);
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
   * Автоматически валидирует и сохраняет в storage
   * @param {string} key - Ключ настройки
   * @param {*} value - Новое значение
   */
  set(key, value) {
    // Санитизировать значение перед сохранением
    const defaultValue = this._defaults ? this._defaults[key] : undefined;
    const sanitized = sanitizeSetting(key, value, defaultValue);

    const oldValue = this.settings[key];
    // Не делаем ничего если значение не изменилось
    if (oldValue === sanitized) return;

    this.settings[key] = sanitized;
    this.storage.save({ [key]: sanitized });
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    this.storage = null;
    this.settings = null;
    this._defaults = null;
  }
}
