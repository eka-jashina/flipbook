/**
 * Unit tests for IdbStorage
 * IndexedDB wrapper with connection pooling and idle timeout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdbStorage } from '../../../js/utils/IdbStorage.js';

// ═══════════════════════════════════════════════════════════════════════════
// INDEXEDDB MOCK
// ═══════════════════════════════════════════════════════════════════════════

/** In-memory store backing the mock IndexedDB */
let storeData;
let openCallCount;
let lastOpenRequest;
let shouldFailOpen;
let shouldFailTransaction;

function createMockObjectStore(readonly = false) {
  return {
    get(key) {
      const req = { result: storeData[key] ?? undefined, error: null };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    put(value, key) {
      if (!readonly) storeData[key] = value;
      const req = { error: null };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    delete(key) {
      if (!readonly) delete storeData[key];
      const req = { error: null };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  };
}

function createMockTransaction(storeName, mode) {
  const store = createMockObjectStore(mode === 'readonly');
  const tx = {
    objectStore: vi.fn(() => store),
    oncomplete: null,
    onerror: null,
    error: null,
  };

  if (shouldFailTransaction) {
    setTimeout(() => {
      tx.error = new DOMException('Transaction failed');
      tx.onerror?.();
    }, 0);
  } else if (mode === 'readwrite') {
    // readwrite: fire oncomplete after store ops
    setTimeout(() => tx.oncomplete?.(), 1);
  }

  return tx;
}

function createMockDb(storeName) {
  const objectStoreNames = { contains: vi.fn(() => true) };
  const db = {
    transaction: vi.fn((sn, mode) => createMockTransaction(sn, mode)),
    createObjectStore: vi.fn(),
    objectStoreNames,
    close: vi.fn(),
    onclose: null,
    onversionchange: null,
  };
  return db;
}

function setupIndexedDBMock() {
  const mockIndexedDB = {
    open(name, version) {
      openCallCount++;
      const db = createMockDb();
      const request = {
        result: db,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      lastOpenRequest = request;

      setTimeout(() => {
        if (shouldFailOpen) {
          request.error = new DOMException('Open failed');
          request.onerror?.();
        } else {
          // Simulate upgrade for version 1
          db.objectStoreNames.contains = vi.fn(() => false);
          request.onupgradeneeded?.();
          db.objectStoreNames.contains = vi.fn(() => true);
          request.onsuccess?.();
        }
      }, 0);

      return request;
    },
  };

  globalThis.indexedDB = mockIndexedDB;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('IdbStorage', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storeData = {};
    openCallCount = 0;
    lastOpenRequest = null;
    shouldFailOpen = false;
    shouldFailTransaction = false;
    setupIndexedDBMock();
  });

  afterEach(() => {
    storage?.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should store dbName, storeName, and version', () => {
      storage = new IdbStorage('test-db', 'test-store', 2);

      expect(storage._dbName).toBe('test-db');
      expect(storage._storeName).toBe('test-store');
      expect(storage._version).toBe(2);
    });

    it('should default version to 1', () => {
      storage = new IdbStorage('test-db', 'test-store');

      expect(storage._version).toBe(1);
    });

    it('should initialize with null connection', () => {
      storage = new IdbStorage('test-db', 'test-store');

      expect(storage._db).toBeNull();
      expect(storage._opening).toBeNull();
      expect(storage._idleTimer).toBeNull();
    });
  });

  describe('_getConnection', () => {
    it('should open a new connection on first call', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      expect(db).toBeDefined();
      expect(openCallCount).toBe(1);
      expect(storage._db).toBe(db);
    });

    it('should reuse existing connection on subsequent calls', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise1 = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      await promise1;

      const promise2 = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      await promise2;

      expect(openCallCount).toBe(1);
    });

    it('should deduplicate concurrent open requests', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const p1 = storage._getConnection();
      const p2 = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);

      const [db1, db2] = await Promise.all([p1, p2]);

      expect(db1).toBe(db2);
      expect(openCallCount).toBe(1);
    });

    it('should reject on open failure', async () => {
      shouldFailOpen = true;
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection().catch((err) => {
        expect(err.message).toBe('Open failed');
        return 'caught';
      });
      await vi.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(result).toBe('caught');
      expect(storage._opening).toBeNull();
    });

    it('should handle onversionchange by closing connection', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      // Simulate versionchange event
      db.onversionchange();

      expect(db.close).toHaveBeenCalled();
      expect(storage._db).toBeNull();
    });

    it('should handle onclose by resetting cached connection', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      // Simulate unexpected close
      db.onclose();

      expect(storage._db).toBeNull();
    });
  });

  describe('idle timeout', () => {
    it('should close connection after 5s of inactivity', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      // Advance past idle timeout (5000ms)
      vi.advanceTimersByTime(5000);

      expect(db.close).toHaveBeenCalled();
      expect(storage._db).toBeNull();
    });

    it('should reset idle timer on each connection access', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      // Advance 4s (not enough to trigger)
      vi.advanceTimersByTime(4000);
      expect(db.close).not.toHaveBeenCalled();

      // Access again — resets timer
      storage._getConnection();

      // Advance another 4s — still not enough from last reset
      vi.advanceTimersByTime(4000);
      expect(db.close).not.toHaveBeenCalled();

      // Advance remaining 1s to complete 5s from last access
      vi.advanceTimersByTime(1000);
      expect(db.close).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      storeData['myKey'] = { data: 'hello' };
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.get('myKey');
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toEqual({ data: 'hello' });
    });

    it('should return null for missing key', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.get('nonexistent');
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toBeNull();
    });
  });

  describe('put', () => {
    it('should store value by key', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.put('key1', { value: 42 });
      await vi.advanceTimersByTimeAsync(10);
      await promise;

      expect(storeData['key1']).toEqual({ value: 42 });
    });

    it('should overwrite existing value', async () => {
      storeData['key1'] = 'old';
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.put('key1', 'new');
      await vi.advanceTimersByTimeAsync(10);
      await promise;

      expect(storeData['key1']).toBe('new');
    });
  });

  describe('delete', () => {
    it('should remove value by key', async () => {
      storeData['key1'] = 'value';
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.delete('key1');
      await vi.advanceTimersByTimeAsync(10);
      await promise;

      expect(storeData['key1']).toBeUndefined();
    });

    it('should not throw for non-existent key', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage.delete('nonexistent');
      await vi.advanceTimersByTimeAsync(10);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should close connection and clear idle timer', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const promise = storage._getConnection();
      await vi.advanceTimersByTimeAsync(10);
      const db = await promise;

      storage.destroy();

      expect(db.close).toHaveBeenCalled();
      expect(storage._db).toBeNull();
      expect(storage._idleTimer).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      storage = new IdbStorage('test-db', 'test-store');

      expect(() => {
        storage.destroy();
        storage.destroy();
      }).not.toThrow();
    });

    it('should be safe to call without ever connecting', () => {
      storage = new IdbStorage('test-db', 'test-store');

      expect(() => storage.destroy()).not.toThrow();
    });
  });
});
