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
    soundVolume: 0.3,
    ambientVolume: 0.5,
    page: 0,
    ambientType: 'none',
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

    it('should sanitize corrupted values from storage', () => {
      mockStorage.load.mockReturnValue({
        fontSize: NaN,
        theme: 'hacked',
        soundVolume: 999,
        page: -5,
      });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(18); // fallback to default
      expect(mgr.settings.theme).toBe('light');
      expect(mgr.settings.soundVolume).toBe(1); // clamped to max
      expect(mgr.settings.page).toBe(0);
    });

    it('should sanitize string fontSize from storage', () => {
      mockStorage.load.mockReturnValue({ fontSize: '20' });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(20);
    });

    it('should sanitize extreme font sizes from storage', () => {
      mockStorage.load.mockReturnValue({ fontSize: 1000 });
      const mgr = new SettingsManager(mockStorage, defaults);

      expect(mgr.settings.fontSize).toBe(72); // clamped to absolute max
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

    it('should sanitize invalid fontSize on set', () => {
      manager.set('fontSize', NaN);
      // NaN sanitized to default (18) — same as current, so no save
      expect(manager.settings.fontSize).toBe(18);
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should clamp extreme fontSize on set', () => {
      manager.set('fontSize', 1000);
      expect(manager.settings.fontSize).toBe(72);
      expect(mockStorage.save).toHaveBeenCalledWith({ fontSize: 72 });
    });

    it('should sanitize invalid theme on set', () => {
      manager.set('theme', 'hacked');
      // Falls back to default 'light' — same as current
      expect(manager.settings.theme).toBe('light');
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should clamp volume on set', () => {
      manager.set('soundVolume', 1.5);
      expect(manager.settings.soundVolume).toBe(1);
      expect(mockStorage.save).toHaveBeenCalledWith({ soundVolume: 1 });
    });

    it('should handle zero value for fontSize (clamps to min)', () => {
      manager.set('fontSize', 0);
      expect(manager.settings.fontSize).toBe(8); // absolute min
    });

    it('should handle null font value (falls back to default)', () => {
      manager.set('font', null);
      // null is sanitized to default 'georgia' — same as current
      expect(manager.settings.font).toBe('georgia');
      expect(mockStorage.save).not.toHaveBeenCalled();
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

    it('should null out defaults', () => {
      manager.destroy();
      expect(manager._defaults).toBeNull();
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
