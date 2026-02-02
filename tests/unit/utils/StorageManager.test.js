/**
 * TESTS: StorageManager
 * Тесты для абстракции над localStorage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageManager } from '@utils/StorageManager.js';

describe('StorageManager', () => {
  let storage;
  const TEST_KEY = 'test-app-settings';

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager(TEST_KEY);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store the key', () => {
      expect(storage.key).toBe(TEST_KEY);
    });

    it('should work with different keys', () => {
      const storage1 = new StorageManager('key1');
      const storage2 = new StorageManager('key2');

      storage1.save({ a: 1 });
      storage2.save({ b: 2 });

      expect(storage1.load()).toEqual({ a: 1 });
      expect(storage2.load()).toEqual({ b: 2 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('load()', () => {
    it('should return empty object when storage is empty', () => {
      expect(storage.load()).toEqual({});
    });

    it('should return parsed data from localStorage', () => {
      localStorage.setItem(TEST_KEY, JSON.stringify({ font: 'arial', size: 16 }));

      expect(storage.load()).toEqual({ font: 'arial', size: 16 });
    });

    it('should return empty object on JSON parse error', () => {
      localStorage.setItem(TEST_KEY, 'invalid json{{{');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(storage.load()).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        settings: {
          font: 'georgia',
          nested: {
            deep: {
              value: 42,
            },
          },
        },
        array: [1, 2, { key: 'value' }],
      };

      localStorage.setItem(TEST_KEY, JSON.stringify(complexData));

      expect(storage.load()).toEqual(complexData);
    });

    it('should handle arrays as root value', () => {
      localStorage.setItem(TEST_KEY, JSON.stringify([1, 2, 3]));

      // Технически load() ожидает объект, но JSON.parse вернёт массив
      expect(storage.load()).toEqual([1, 2, 3]);
    });

    it('should return empty object when localStorage throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(storage.load()).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('save()', () => {
    it('should save data to localStorage', () => {
      storage.save({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge with existing data (patch update)', () => {
      storage.save({ font: 'georgia' });
      storage.save({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ font: 'georgia', theme: 'dark' });
    });

    it('should overwrite existing fields', () => {
      storage.save({ font: 'georgia' });
      storage.save({ font: 'arial' });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ font: 'arial' });
    });

    it('should preserve unmodified fields', () => {
      storage.save({ a: 1, b: 2, c: 3 });
      storage.save({ b: 20 });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ a: 1, b: 20, c: 3 });
    });

    it('should handle empty patch', () => {
      storage.save({ existing: 'value' });
      storage.save({});

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ existing: 'value' });
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Симулируем ошибку квоты
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(() => storage.save({ data: 'test' })).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle various value types', () => {
      storage.save({
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
      });

      const stored = storage.load();
      expect(stored.string).toBe('hello');
      expect(stored.number).toBe(42);
      expect(stored.boolean).toBe(true);
      expect(stored.null).toBeNull();
      expect(stored.array).toEqual([1, 2, 3]);
      expect(stored.object).toEqual({ nested: 'value' });
    });

    it('should handle special characters in values', () => {
      storage.save({
        unicode: 'Привет мир 你好世界',
        special: '!@#$%^&*()_+{}[]',
        quotes: '"\'`',
      });

      const stored = storage.load();
      expect(stored.unicode).toBe('Привет мир 你好世界');
      expect(stored.special).toBe('!@#$%^&*()_+{}[]');
      expect(stored.quotes).toBe('"\'`');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should remove data from localStorage', () => {
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('should return empty object after clear', () => {
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(storage.load()).toEqual({});
    });

    it('should not affect other keys', () => {
      localStorage.setItem('other-key', 'other-value');
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(localStorage.getItem('other-key')).toBe('other-value');
    });

    it('should handle clear on empty storage', () => {
      expect(() => storage.clear()).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => storage.clear()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      removeItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should allow save after clear', () => {
      storage.save({ before: 'clear' });
      storage.clear();
      storage.save({ after: 'clear' });

      expect(storage.load()).toEqual({ after: 'clear' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isolation between instances', () => {
    it('should not share data between different keys', () => {
      const storage1 = new StorageManager('app1');
      const storage2 = new StorageManager('app2');

      storage1.save({ data: 'from app1' });
      storage2.save({ data: 'from app2' });

      expect(storage1.load().data).toBe('from app1');
      expect(storage2.load().data).toBe('from app2');
    });

    it('should allow multiple instances with same key', () => {
      const instance1 = new StorageManager(TEST_KEY);
      const instance2 = new StorageManager(TEST_KEY);

      instance1.save({ value: 1 });
      expect(instance2.load()).toEqual({ value: 1 });

      instance2.save({ value: 2 });
      expect(instance1.load()).toEqual({ value: 2 });
    });
  });
});
