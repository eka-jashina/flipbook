/**
 * Тесты для SettingsManager
 * Управление настройками с персистентностью
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

describe('SettingsManager', () => {
  let manager;
  let mockStorage;
  const defaults = {
    font: 'georgia',
    fontSize: 18,
    theme: 'light',
    soundEnabled: true,
  };

  beforeEach(() => {
    mockStorage = {
      load: vi.fn().mockReturnValue({}),
      save: vi.fn(),
    };
    manager = new SettingsManager(mockStorage, defaults);
  });

  describe('constructor', () => {
    it('should merge defaults with stored settings', () => {
      expect(manager.settings).toEqual(defaults);
    });

    it('should override defaults with stored values', () => {
      mockStorage.load.mockReturnValue({ font: 'inter', fontSize: 20 });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.font).toBe('inter');
      expect(mgr.settings.fontSize).toBe(20);
      expect(mgr.settings.theme).toBe('light'); // from defaults
    });

    it('should load from storage', () => {
      expect(mockStorage.load).toHaveBeenCalled();
    });

    it('should store reference to storage', () => {
      expect(manager.storage).toBe(mockStorage);
    });
  });

  describe('get', () => {
    it('should return setting value', () => {
      expect(manager.get('font')).toBe('georgia');
    });

    it('should return undefined for unknown key', () => {
      expect(manager.get('unknown')).toBeUndefined();
    });

    it('should return stored value after override', () => {
      mockStorage.load.mockReturnValue({ theme: 'dark' });
      const mgr = new SettingsManager(mockStorage, defaults);
      expect(mgr.get('theme')).toBe('dark');
    });
  });

  describe('set', () => {
    it('should update setting value', () => {
      manager.set('font', 'inter');
      expect(manager.settings.font).toBe('inter');
    });

    it('should save to storage', () => {
      manager.set('fontSize', 20);
      expect(mockStorage.save).toHaveBeenCalledWith({ fontSize: 20 });
    });

    it('should not save if value unchanged', () => {
      manager.set('font', 'georgia'); // same as default
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should save when value changes from stored', () => {
      manager.set('font', 'inter');
      expect(mockStorage.save).toHaveBeenCalledWith({ font: 'inter' });
    });

    it('should handle new keys', () => {
      manager.set('newKey', 'newValue');
      expect(manager.settings.newKey).toBe('newValue');
      expect(mockStorage.save).toHaveBeenCalledWith({ newKey: 'newValue' });
    });

    it('should handle falsy values', () => {
      manager.set('soundEnabled', false);
      expect(manager.settings.soundEnabled).toBe(false);
      expect(mockStorage.save).toHaveBeenCalledWith({ soundEnabled: false });
    });

    it('should handle zero value', () => {
      manager.set('fontSize', 0);
      expect(manager.settings.fontSize).toBe(0);
      expect(mockStorage.save).toHaveBeenCalledWith({ fontSize: 0 });
    });

    it('should handle null value', () => {
      manager.set('font', null);
      expect(manager.settings.font).toBeNull();
      expect(mockStorage.save).toHaveBeenCalledWith({ font: null });
    });
  });

  describe('destroy', () => {
    it('should null out storage reference', () => {
      manager.destroy();
      expect(manager.storage).toBeNull();
    });

    it('should null out settings', () => {
      manager.destroy();
      expect(manager.settings).toBeNull();
    });
  });

  describe('integration', () => {
    it('should persist and retrieve values correctly', () => {
      manager.set('theme', 'dark');
      manager.set('fontSize', 22);

      // Simulate creating new manager with same storage
      const savedData = {};
      mockStorage.save.mockImplementation((data) => {
        Object.assign(savedData, data);
      });
      mockStorage.load.mockReturnValue(savedData);

      manager.set('font', 'roboto');

      const newManager = new SettingsManager(mockStorage, defaults);
      expect(newManager.get('font')).toBe('roboto');
    });
  });
});
