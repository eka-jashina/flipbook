/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью.
 *
 * Особенности:
 * - Автоматическое сохранение в localStorage
 * - Слияние defaults с сохранёнными настройками
 * - Предотвращение лишних сохранений при одинаковых значениях
 */

export class SettingsManager {
  /**
   * @param {StorageManager} storage - Менеджер хранилища
   * @param {Object} defaults - Значения по умолчанию
   */
  constructor(storage, defaults) {
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
   * Автоматически сохраняет в storage
   * @param {string} key - Ключ настройки
   * @param {*} value - Новое значение
   */
  set(key, value) {
    const oldValue = this.settings[key];
    // Не делаем ничего если значение не изменилось
    if (oldValue === value) return;

    this.settings[key] = value;
    this.storage.save({ [key]: value });
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    this.storage = null;
    this.settings = null;
  }
}
