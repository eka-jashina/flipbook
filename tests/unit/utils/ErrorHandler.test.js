/**
 * TESTS: ErrorHandler
 * Тесты для централизованной обработки и отображения ошибок
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler } from '@utils/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorElement;
  let textElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Создаём DOM-элементы для отображения ошибок
    errorElement = document.createElement('div');
    errorElement.id = 'errorMessage';
    errorElement.hidden = true;

    textElement = document.createElement('span');
    textElement.id = 'errorText';

    errorElement.appendChild(textElement);
    document.body.appendChild(errorElement);
  });

  afterEach(() => {
    vi.useRealTimers();

    // Очищаем DOM
    document.body.innerHTML = '';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show()', () => {
    it('should set error text', () => {
      ErrorHandler.show('Test error message');

      expect(textElement.textContent).toBe('Test error message');
    });

    it('should unhide error container', () => {
      expect(errorElement.hidden).toBe(true);

      ErrorHandler.show('Error');

      expect(errorElement.hidden).toBe(false);
    });

    it('should auto-hide after 5 seconds', () => {
      ErrorHandler.show('Temporary error');

      expect(errorElement.hidden).toBe(false);

      vi.advanceTimersByTime(5000);

      expect(errorElement.hidden).toBe(true);
    });

    it('should not hide before 5 seconds', () => {
      ErrorHandler.show('Error');

      vi.advanceTimersByTime(4999);

      expect(errorElement.hidden).toBe(false);
    });

    it('should handle multiple show calls', () => {
      ErrorHandler.show('First error');
      ErrorHandler.show('Second error');

      expect(textElement.textContent).toBe('Second error');
      expect(errorElement.hidden).toBe(false);
    });

    it('should handle empty message', () => {
      ErrorHandler.show('');

      expect(textElement.textContent).toBe('');
      expect(errorElement.hidden).toBe(false);
    });

    it('should handle long message', () => {
      const longMessage = 'A'.repeat(1000);
      ErrorHandler.show(longMessage);

      expect(textElement.textContent).toBe(longMessage);
    });

    it('should handle special characters', () => {
      const specialMessage = '<script>alert("xss")</script>';
      ErrorHandler.show(specialMessage);

      // textContent автоматически экранирует HTML
      expect(textElement.textContent).toBe(specialMessage);
    });

    it('should handle unicode characters', () => {
      const unicodeMessage = 'Ошибка: 文件未找到 🚫';
      ErrorHandler.show(unicodeMessage);

      expect(textElement.textContent).toBe(unicodeMessage);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show() - FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show() fallback', () => {
    beforeEach(() => {
      // Удаляем стандартные элементы
      document.body.innerHTML = '';
    });

    it('should log error when container not found', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error message container not found in DOM');

      consoleErrorSpy.mockRestore();
    });

    it('should create fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback message');

      const fallback = document.querySelector('.error-message');
      expect(fallback).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should set message in fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback text');

      const fallback = document.querySelector('.error-message');
      expect(fallback.textContent).toBe('Fallback text');

      consoleErrorSpy.mockRestore();
    });

    it('should set role="alert" on fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Accessible error');

      const fallback = document.querySelector('.error-message');
      expect(fallback.getAttribute('role')).toBe('alert');

      consoleErrorSpy.mockRestore();
    });

    it('should append fallback to body', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Body error');

      const fallback = document.body.querySelector('.error-message');
      expect(fallback).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should remove fallback after 5 seconds', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Temporary fallback');

      expect(document.querySelector('.error-message')).not.toBeNull();

      vi.advanceTimersByTime(5000);

      expect(document.querySelector('.error-message')).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should use fallback when only errorMessage missing', () => {
      // Есть errorText но нет errorMessage
      const orphanText = document.createElement('span');
      orphanText.id = 'errorText';
      document.body.appendChild(orphanText);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Partial missing');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(document.querySelector('.error-message')).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should use fallback when only errorText missing', () => {
      // Есть errorMessage но нет errorText
      const container = document.createElement('div');
      container.id = 'errorMessage';
      document.body.appendChild(container);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Text missing');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(document.querySelector('.error-message')).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handle()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handle()', () => {
    it('should log error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      ErrorHandler.handle(error, 'User message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should show user message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Internal'), 'Something went wrong');

      expect(textElement.textContent).toBe('Something went wrong');

      consoleErrorSpy.mockRestore();
    });

    it('should use default message if not provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Test'));

      expect(textElement.textContent).toBe('Произошла ошибка');

      consoleErrorSpy.mockRestore();
    });

    it('should unhide error container', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Test'), 'Error');

      expect(errorElement.hidden).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should handle Error subclasses', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const typeError = new TypeError('Type mismatch');

      ErrorHandler.handle(typeError, 'Type error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', typeError);
      expect(textElement.textContent).toBe('Type error occurred');

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error objects', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle('string error', 'String error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'string error');

      ErrorHandler.handle({ code: 500 }, 'Object error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', { code: 500 });

      consoleErrorSpy.mockRestore();
    });

    it('should handle null error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(null, 'Null error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', null);
      expect(textElement.textContent).toBe('Null error');

      consoleErrorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _showFallback()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_showFallback()', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should create div element', () => {
      ErrorHandler._showFallback('Test');

      const fallback = document.querySelector('div.error-message');
      expect(fallback).not.toBeNull();
    });

    it('should set error-message class', () => {
      ErrorHandler._showFallback('Test');

      const fallback = document.querySelector('.error-message');
      expect(fallback.className).toBe('error-message');
    });

    it('should set message as textContent', () => {
      ErrorHandler._showFallback('Fallback text content');

      const fallback = document.querySelector('.error-message');
      expect(fallback.textContent).toBe('Fallback text content');
    });

    it('should set role="alert" attribute', () => {
      ErrorHandler._showFallback('Alert message');

      const fallback = document.querySelector('.error-message');
      expect(fallback.getAttribute('role')).toBe('alert');
    });

    it('should append to document body', () => {
      ErrorHandler._showFallback('Body child');

      expect(document.body.children.length).toBe(1);
      expect(document.body.firstChild.classList.contains('error-message')).toBe(true);
    });

    it('should remove element after 5 seconds', () => {
      ErrorHandler._showFallback('Temporary');

      expect(document.querySelector('.error-message')).not.toBeNull();

      vi.advanceTimersByTime(5000);

      expect(document.querySelector('.error-message')).toBeNull();
    });

    it('should handle multiple fallback calls', () => {
      ErrorHandler._showFallback('First');
      ErrorHandler._showFallback('Second');
      ErrorHandler._showFallback('Third');

      const fallbacks = document.querySelectorAll('.error-message');
      expect(fallbacks.length).toBe(3);

      vi.advanceTimersByTime(5000);

      expect(document.querySelectorAll('.error-message').length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('timing interactions', () => {
    it('should accumulate hide timers on consecutive show calls', () => {
      // Текущая реализация не сбрасывает предыдущие таймеры
      ErrorHandler.show('First');
      vi.advanceTimersByTime(3000);

      ErrorHandler.show('Second');
      vi.advanceTimersByTime(2000);

      // Первый таймер (5000ms) уже сработал и скрыл элемент
      expect(errorElement.hidden).toBe(true);

      // Но текст был обновлён вторым вызовом
      expect(textElement.textContent).toBe('Second');
    });

    it('should handle rapid show/hide cycles', () => {
      for (let i = 0; i < 3; i++) {
        ErrorHandler.show(`Error ${i}`);
      }

      // Сразу после вызовов элемент видим
      expect(errorElement.hidden).toBe(false);
      expect(textElement.textContent).toBe('Error 2');

      // После 5 секунд первый таймер скроет элемент
      vi.advanceTimersByTime(5000);
      expect(errorElement.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle show being called without init', () => {
      // Recreate fresh DOM without elements
      document.body.innerHTML = '';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ErrorHandler.show('No DOM')).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should handle handle being called without init', () => {
      document.body.innerHTML = '';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ErrorHandler.handle(new Error('No DOM'), 'Message')).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should escape HTML in fallback textContent', () => {
      document.body.innerHTML = '';

      ErrorHandler._showFallback('<img src=x onerror=alert(1)>');

      const fallback = document.querySelector('.error-message');
      // textContent не интерпретирует HTML
      expect(fallback.innerHTML).not.toContain('<img');
      expect(fallback.textContent).toBe('<img src=x onerror=alert(1)>');
    });
  });
});
