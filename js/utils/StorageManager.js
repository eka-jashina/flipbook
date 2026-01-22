/**
 * STORAGE MANAGER
 * Абстракция над localStorage с обработкой ошибок.
 */

export class StorageManager {
  constructor(key) {
    this.key = key;
  }

  load() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Storage load error:", error);
      return {};
    }
  }

  save(patch) {
    try {
      const data = this.load();
      localStorage.setItem(this.key, JSON.stringify({ ...data, ...patch }));
    } catch (error) {
      console.error("Storage save error:", error);
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  }
}
