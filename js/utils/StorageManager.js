/**
 * STORAGE MANAGER
 * Абстракция над localStorage с обработкой ошибок.
 *
 * Особенности:
 * - Автоматическая сериализация/десериализация JSON
 * - Безопасная работа с ошибками (QuotaExceeded, SecurityError)
 * - Патч-обновление данных (merge вместо полной перезаписи)
 * - Единый ключ для группировки настроек приложения
 */

export class StorageManager {
  /**
   * @param {string} key - Ключ в localStorage для хранения данных
   */
  constructor(key) {
    this.key = key;
  }

  /**
   * Загрузить данные из localStorage
   * @returns {Object} Сохранённые данные или пустой объект
   */
  load() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Storage load error:", error);
      return {};
    }
  }

  /**
   * Сохранить данные в localStorage (merge с существующими)
   * @param {Object} patch - Объект с новыми/изменёнными полями
   */
  save(patch) {
    try {
      const data = this.load();
      localStorage.setItem(this.key, JSON.stringify({ ...data, ...patch }));
    } catch (error) {
      console.error("Storage save error:", error);
    }
  }

  /**
   * Полностью очистить данные по ключу
   */
  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  }
}
