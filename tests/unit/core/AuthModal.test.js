/**
 * TESTS: AuthModal
 * Тесты для модального окна аутентификации
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthModal } from '@core/AuthModal.js';

describe('AuthModal', () => {
  let modal;
  let mockApi;
  let onAuth;

  beforeEach(() => {
    mockApi = {
      login: vi.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
      register: vi.fn().mockResolvedValue({ id: 2, email: 'new@test.com' }),
    };
    onAuth = vi.fn();
    modal = new AuthModal({ apiClient: mockApi, onAuth });
  });

  afterEach(() => {
    modal.destroy();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with login mode', () => {
      expect(modal._mode).toBe('login');
    });

    it('should not render overlay on creation', () => {
      expect(modal._el).toBeNull();
    });

    it('should store api and onAuth references', () => {
      expect(modal._api).toBe(mockApi);
      expect(modal._onAuth).toBe(onAuth);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show / hide
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show', () => {
    it('should create overlay in DOM', () => {
      modal.show();

      expect(modal._el).not.toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeTruthy();
    });

    it('should render login form', () => {
      modal.show();

      expect(modal._el.querySelector('.auth-form')).toBeTruthy();
      expect(modal._el.querySelector('#auth-email')).toBeTruthy();
      expect(modal._el.querySelector('#auth-password')).toBeTruthy();
    });

    it('should not render name field in login mode', () => {
      modal.show();
      expect(modal._el.querySelector('#auth-name')).toBeNull();
    });

    it('should be no-op if already shown', () => {
      modal.show();
      const el = modal._el;

      modal.show();
      expect(modal._el).toBe(el);
    });

    it('should add keydown listener', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      modal.show();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('hide', () => {
    it('should remove overlay from DOM', () => {
      modal.show();
      modal.hide();

      expect(modal._el).toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeNull();
    });

    it('should be no-op if not shown', () => {
      modal.hide(); // should not throw
      expect(modal._el).toBeNull();
    });

    it('should remove keydown listener', () => {
      const spy = vi.spyOn(document, 'removeEventListener');
      modal.show();
      modal.hide();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('destroy', () => {
    it('should call hide', () => {
      modal.show();
      modal.destroy();

      expect(modal._el).toBeNull();
      expect(document.querySelector('.auth-overlay')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Mode switching
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mode switching', () => {
    it('should switch to register mode', () => {
      modal.show();

      const switchBtn = modal._el.querySelector('[data-action="switch"]');
      switchBtn.click();

      expect(modal._mode).toBe('register');
      expect(modal._el.querySelector('#auth-name')).toBeTruthy();
    });

    it('should switch back to login mode', () => {
      modal.show();

      // switch to register
      modal._el.querySelector('[data-action="switch"]').click();
      // switch back to login
      modal._el.querySelector('[data-action="switch"]').click();

      expect(modal._mode).toBe('login');
      expect(modal._el.querySelector('#auth-name')).toBeNull();
    });

    it('should render correct title for register mode', () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      const title = modal._el.querySelector('.auth-modal-title');
      expect(title.textContent).toBe('Регистрация');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Form submission
  // ═══════════════════════════════════════════════════════════════════════════

  describe('form submission', () => {
    it('should show error for empty email', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = '';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const errorEl = modal._el.querySelector('#auth-error');
      expect(errorEl.hidden).toBe(false);
      expect(errorEl.textContent).toContain('email');
    });

    it('should show error for short password', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = '1234567';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      const errorEl = modal._el.querySelector('#auth-error');
      expect(errorEl.hidden).toBe(false);
      expect(errorEl.textContent).toContain('8');
    });

    it('should call login on valid form in login mode', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      // Ждём async _handleSubmit
      await vi.waitFor(() => {
        expect(mockApi.login).toHaveBeenCalledWith('test@test.com', 'password123');
      });
    });

    it('should call onAuth after successful login', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(onAuth).toHaveBeenCalledWith({ id: 1, email: 'test@test.com' });
      });
    });

    it('should hide modal after successful login', async () => {
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(document.querySelector('.auth-overlay')).toBeNull();
      });
    });

    it('should call register in register mode', async () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      modal._el.querySelector('#auth-name').value = 'Test User';
      modal._el.querySelector('#auth-email').value = 'new@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(mockApi.register).toHaveBeenCalledWith('new@test.com', 'password123', 'Test User');
      });
    });

    it('should show error on API failure', async () => {
      mockApi.login.mockRejectedValue(new Error('Invalid credentials'));
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = modal._el.querySelector('#auth-error');
        expect(errorEl.hidden).toBe(false);
        expect(errorEl.textContent).toContain('Invalid credentials');
      });
    });

    it('should disable and re-enable submit button on error', async () => {
      mockApi.login.mockRejectedValue(new Error('Error'));
      modal.show();

      modal._el.querySelector('#auth-email').value = 'test@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        const submitBtn = modal._el.querySelector('.auth-submit');
        expect(submitBtn.disabled).toBe(false);
      });
    });

    it('should pass null name if name field empty in register', async () => {
      modal.show();
      modal._el.querySelector('[data-action="switch"]').click();

      modal._el.querySelector('#auth-name').value = '';
      modal._el.querySelector('#auth-email').value = 'new@test.com';
      modal._el.querySelector('#auth-password').value = 'password123';

      const form = modal._el.querySelector('.auth-form');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await vi.waitFor(() => {
        expect(mockApi.register).toHaveBeenCalledWith('new@test.com', 'password123', null);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Keyboard
  // ═══════════════════════════════════════════════════════════════════════════

  describe('keyboard', () => {
    it('should not close on Escape (mandatory auth)', () => {
      modal.show();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(modal._el).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _render edge case
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_render', () => {
    it('should remove old overlay when re-rendering', () => {
      modal.show();
      const oldEl = modal._el;

      // Switch triggers re-render
      modal._el.querySelector('[data-action="switch"]').click();

      expect(document.body.contains(oldEl)).toBe(false);
    });
  });
});
