/**
 * STORAGE MANAGER
 * Абстракция над localStorage с обработкой ошибок.
 *
 * Особенности:
 * - Автоматическая сериализация/десериализация JSON
 * - Безопасная работа с ошибками (QuotaExceeded, SecurityError)
 * - Патч-обновление данных (merge вместо полной перезаписи)
 * - Единый ключ для группировки настроек приложения
 * - Возвращает результат save() (success/failure) для обработки вызывающим кодом
 */

export class StorageManager {
  /**
   * @param {string} key - Ключ в localStorage для хранения данных
   */
  constructor(key) {
    this.key = key;

    /**
     * Коллбэк на ошибку квоты — позволяет UI показать предупреждение.
     * @type {((key: string) => void)|null}
     */
    this.onQuotaExceeded = null;
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
   * @returns {boolean} true если сохранение прошло успешно
   */
  save(patch) {
    try {
      const data = this.load();
      localStorage.setItem(this.key, JSON.stringify({ ...data, ...patch }));
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn("Storage quota exceeded. Unable to save data for key:", this.key);
        if (this.onQuotaExceeded) {
          this.onQuotaExceeded(this.key);
        }
      } else {
        console.error("Storage save error:", error);
      }
      return false;
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
