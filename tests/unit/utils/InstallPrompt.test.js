/**
 * UNIT TEST: InstallPrompt
 * Тестирование PWA install prompt баннера
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstallPrompt } from '../../../js/utils/InstallPrompt.js';

describe('InstallPrompt', () => {
  let prompt;

  beforeEach(() => {
    // По умолчанию — не standalone
    global.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // navigator.standalone не определён по умолчанию
    Object.defineProperty(window, 'navigator', {
      value: { ...window.navigator, standalone: undefined },
      writable: true,
      configurable: true,
    });

    prompt = new InstallPrompt();
  });

  afterEach(() => {
    prompt.destroy();
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should initialize with null deferred prompt', () => {
      expect(prompt._deferredPrompt).toBeNull();
    });

    it('should initialize with null banner', () => {
      expect(prompt._banner).toBeNull();
    });

    it('should not add event listeners in standalone mode', () => {
      // Переключаем в standalone
      global.matchMedia = vi.fn(() => ({ matches: true }));
      Object.defineProperty(window, 'navigator', {
        value: { standalone: true },
        writable: true,
        configurable: true,
      });

      const addSpy = vi.spyOn(window, 'addEventListener');
      const standalonePrompt = new InstallPrompt();

      const beforeInstallCalls = addSpy.mock.calls.filter(c => c[0] === 'beforeinstallprompt');
      // В standalone — события не привязываются
      expect(beforeInstallCalls.length).toBe(0);

      standalonePrompt.destroy();
    });
  });

  describe('canInstall', () => {
    it('should return false when no deferred prompt', () => {
      expect(prompt.canInstall).toBe(false);
    });

    it('should return true when deferred prompt is available', () => {
      prompt._deferredPrompt = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
      expect(prompt.canInstall).toBe(true);
    });
  });

  describe('_onBeforeInstall', () => {
    it('should capture deferred prompt event', () => {
      const event = { preventDefault: vi.fn() };
      prompt._onBeforeInstall(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(prompt._deferredPrompt).toBe(event);
    });

    it('should schedule show if not dismissed', () => {
      const event = { preventDefault: vi.fn() };
      prompt._onBeforeInstall(event);

      expect(prompt._showTimeout).not.toBeNull();
    });

    it('should not schedule show if dismissed', () => {
      localStorage.setItem('flipbook_install_dismissed', 'true');

      const event = { preventDefault: vi.fn() };
      prompt._onBeforeInstall(event);

      expect(prompt._showTimeout).toBeNull();
    });

    it('should notify listeners', () => {
      const listener = vi.fn();
      prompt.onStateChange(listener);

      // Будет вызван сразу с undefined (нет prompt), сбросим
      listener.mockClear();

      const event = { preventDefault: vi.fn() };
      prompt._onBeforeInstall(event);

      expect(listener).toHaveBeenCalledWith('available');
    });
  });

  describe('_onAppInstalled', () => {
    it('should clear deferred prompt', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt._onAppInstalled();

      expect(prompt._deferredPrompt).toBeNull();
    });

    it('should notify listeners with installed', () => {
      const listener = vi.fn();
      prompt.onStateChange(listener);
      listener.mockClear();

      prompt._onAppInstalled();
      expect(listener).toHaveBeenCalledWith('installed');
    });
  });

  describe('show', () => {
    it('should not show without deferred prompt', () => {
      prompt.show();
      expect(prompt._banner).toBeNull();
    });

    it('should create banner when deferred prompt exists', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();

      expect(prompt._banner).not.toBeNull();
      expect(document.body.querySelector('.install-prompt')).not.toBeNull();
    });

    it('should set role=dialog on banner', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();

      expect(prompt._banner.getAttribute('role')).toBe('dialog');
    });

    it('should not create duplicate banner', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();
      prompt.show();

      expect(document.body.querySelectorAll('.install-prompt').length).toBe(1);
    });

    it('should have install and dismiss buttons', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();

      expect(prompt._banner.querySelector('.install-prompt__btn--install')).not.toBeNull();
      expect(prompt._banner.querySelector('.install-prompt__btn--dismiss')).not.toBeNull();
      expect(prompt._banner.querySelector('.install-prompt__close')).not.toBeNull();
    });
  });

  describe('hide', () => {
    it('should do nothing when no banner', () => {
      expect(() => prompt.hide()).not.toThrow();
    });

    it('should remove visible class from banner', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();
      prompt._banner.classList.add('install-prompt--visible');

      prompt.hide();
      expect(prompt._banner.classList.contains('install-prompt--visible')).toBe(false);
    });

    it('should remove banner from DOM after timeout', async () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();

      prompt.hide();

      await new Promise(resolve => setTimeout(resolve, 350));
      expect(document.body.querySelector('.install-prompt')).toBeNull();
      expect(prompt._banner).toBeNull();
    });
  });

  describe('dismiss', () => {
    it('should save dismissed state to localStorage', () => {
      prompt.dismiss();
      expect(localStorage.getItem('flipbook_install_dismissed')).toBe('true');
    });

    it('should notify listeners with dismissed', () => {
      const listener = vi.fn();
      prompt.onStateChange(listener);
      listener.mockClear();

      prompt.dismiss();
      expect(listener).toHaveBeenCalledWith('dismissed');
    });

    it('should hide the banner', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };
      prompt.show();

      const hideSpy = vi.spyOn(prompt, 'hide');
      prompt.dismiss();
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('install', () => {
    it('should return false when no deferred prompt', async () => {
      const result = await prompt.install();
      expect(result).toBe(false);
    });

    it('should call prompt on deferred event', async () => {
      const mockPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      prompt._deferredPrompt = mockPrompt;

      await prompt.install();
      expect(mockPrompt.prompt).toHaveBeenCalled();
    });

    it('should return true when user accepts', async () => {
      prompt._deferredPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      const result = await prompt.install();
      expect(result).toBe(true);
    });

    it('should return false when user dismisses', async () => {
      prompt._deferredPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      };

      const result = await prompt.install();
      expect(result).toBe(false);
    });

    it('should clear deferred prompt after install', async () => {
      prompt._deferredPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };

      await prompt.install();
      expect(prompt._deferredPrompt).toBeNull();
    });
  });

  describe('onStateChange', () => {
    it('should immediately notify if prompt already available', () => {
      prompt._deferredPrompt = { prompt: vi.fn() };

      const listener = vi.fn();
      prompt.onStateChange(listener);

      expect(listener).toHaveBeenCalledWith('available');
    });

    it('should not notify if prompt not available', () => {
      const listener = vi.fn();
      prompt.onStateChange(listener);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = prompt.onStateChange(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      // After unsubscribe, listener should not be called
      prompt._notifyListeners('test');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('resetDismissed', () => {
    it('should remove dismissed flag from localStorage', () => {
      localStorage.setItem('flipbook_install_dismissed', 'true');

      prompt.resetDismissed();
      expect(localStorage.getItem('flipbook_install_dismissed')).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should clear scheduled show timeout', () => {
      prompt._showTimeout = setTimeout(() => {}, 30000);

      prompt.destroy();
      // No way to verify clearTimeout directly, but no errors
    });

    it('should clear listeners array', () => {
      prompt.onStateChange(() => {});
      prompt.onStateChange(() => {});

      prompt.destroy();
      expect(prompt._listeners.length).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      prompt.destroy();
      expect(() => prompt.destroy()).not.toThrow();
    });
  });
});
