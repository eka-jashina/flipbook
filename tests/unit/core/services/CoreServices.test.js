/**
 * TESTS: CoreServices
 * Тесты для группы базовых инфраструктурных сервисов
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем все импортируемые зависимости (используем function, не arrow, чтобы были constructible)
const { MockDOMManager, MockEventListenerManager, MockTimerManager, MockStorageManager } = vi.hoisted(() => {
  const MockDOMManager = vi.fn(function () {
    this.get = vi.fn();
    this.getMultiple = vi.fn();
    this.clearPages = vi.fn();
    this.elements = {};
  });
  const MockEventListenerManager = vi.fn(function () {
    this.add = vi.fn();
    this.remove = vi.fn();
    this.clear = vi.fn();
    this.count = 0;
  });
  const MockTimerManager = vi.fn(function () {
    this.setTimeout = vi.fn();
    this.clearTimeout = vi.fn();
    this.requestAnimationFrame = vi.fn();
    this.cancelAnimationFrame = vi.fn();
    this.clear = vi.fn();
  });
  const MockStorageManager = vi.fn(function () {
    this.load = vi.fn(() => ({}));
    this.save = vi.fn();
    this.clear = vi.fn();
  });
  return { MockDOMManager, MockEventListenerManager, MockTimerManager, MockStorageManager };
});

vi.mock('@core/DOMManager.js', () => ({ DOMManager: MockDOMManager }));
vi.mock('@utils/index.js', () => ({
  EventListenerManager: MockEventListenerManager,
  TimerManager: MockTimerManager,
  StorageManager: MockStorageManager,
}));
vi.mock('@/config.js', () => ({
  CONFIG: Object.freeze({ STORAGE_KEY: 'reader-settings' }),
}));

import { CoreServices } from '@core/services/CoreServices.js';

describe('CoreServices', () => {
  let services;

  beforeEach(() => {
    vi.clearAllMocks();
    services = new CoreServices();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should create DOMManager instance', () => {
      expect(MockDOMManager).toHaveBeenCalledOnce();
      expect(services.dom).toBeDefined();
    });

    it('should create EventListenerManager instance', () => {
      expect(MockEventListenerManager).toHaveBeenCalledOnce();
      expect(services.eventManager).toBeDefined();
    });

    it('should create TimerManager instance', () => {
      expect(MockTimerManager).toHaveBeenCalledOnce();
      expect(services.timerManager).toBeDefined();
    });

    it('should create StorageManager with CONFIG.STORAGE_KEY', () => {
      expect(MockStorageManager).toHaveBeenCalledWith('reader-settings');
      expect(services.storage).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should clear eventManager', () => {
      const clearSpy = services.eventManager.clear;
      services.destroy();
      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('should clear timerManager', () => {
      const clearSpy = services.timerManager.clear;
      services.destroy();
      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('should clear DOM pages', () => {
      const clearPagesSpy = services.dom.clearPages;
      services.destroy();
      expect(clearPagesSpy).toHaveBeenCalledOnce();
    });

    it('should nullify all references', () => {
      services.destroy();
      expect(services.dom).toBeNull();
      expect(services.eventManager).toBeNull();
      expect(services.timerManager).toBeNull();
      expect(services.storage).toBeNull();
    });
  });
});
