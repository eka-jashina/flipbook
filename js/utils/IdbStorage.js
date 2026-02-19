/**
 * IdbStorage
 *
 * Минимальная обёртка над IndexedDB:
 * открытие соединения, get/put/delete по ключу.
 *
 * Каждая операция самостоятельно открывает и закрывает соединение.
 * Не содержит бизнес-логики — чистый инфраструктурный слой.
 */

export class IdbStorage {
  /**
   * @param {string} dbName - Имя базы данных IndexedDB
   * @param {string} storeName - Имя object store
   * @param {number} [version=1] - Версия базы данных
   */
  constructor(dbName, storeName, version = 1) {
    this._dbName = dbName;
    this._storeName = storeName;
    this._version = version;
  }

  /** Открыть соединение с IndexedDB */
  _open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, this._version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this._storeName)) {
          db.createObjectStore(this._storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Прочитать значение по ключу */
  async get(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  /** Записать значение по ключу (resolve только после фиксации транзакции) */
  async put(key, value) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);
      store.put(value, key);

      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  /** Удалить значение по ключу (resolve только после фиксации транзакции) */
  async delete(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);
      store.delete(key);

      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
}
