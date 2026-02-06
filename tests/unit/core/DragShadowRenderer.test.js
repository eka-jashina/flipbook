/**
 * UNIT TEST: DragShadowRenderer
 * Тестирование рендеринга теней при drag-перелистывании
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DragShadowRenderer } from '../../../js/core/delegates/DragShadowRenderer.js';

describe('DragShadowRenderer', () => {
  let renderer;
  let mockDom;
  let bookEl;
  let flipShadowEl;

  beforeEach(() => {
    bookEl = document.createElement('div');
    flipShadowEl = document.createElement('div');

    mockDom = {
      get: vi.fn((id) => {
        if (id === 'book') return bookEl;
        if (id === 'flipShadow') return flipShadowEl;
        return null;
      }),
    };

    renderer = new DragShadowRenderer(mockDom);
  });

  afterEach(() => {
    // Безопасно — destroy() теперь идемпотентен
    renderer?.destroy();
  });

  describe('constructor', () => {
    it('should store dom reference', () => {
      expect(renderer.dom).toBe(mockDom);
    });
  });

  describe('activate', () => {
    it('should add active class to flipShadow', () => {
      renderer.activate('next');
      expect(flipShadowEl.classList.contains('active')).toBe(true);
    });

    it('should set direction dataset for next', () => {
      renderer.activate('next');
      expect(flipShadowEl.dataset.direction).toBe('next');
    });

    it('should set direction dataset for prev', () => {
      renderer.activate('prev');
      expect(flipShadowEl.dataset.direction).toBe('prev');
    });

    it('should handle missing flipShadow element', () => {
      mockDom.get = vi.fn(() => null);
      expect(() => renderer.activate('next')).not.toThrow();
    });
  });

  describe('update', () => {
    it('should set spine shadow CSS variables on book', () => {
      renderer.update(90, 'next', false);

      const alpha = bookEl.style.getPropertyValue('--spine-shadow-alpha');
      const size = bookEl.style.getPropertyValue('--spine-shadow-size');

      expect(alpha).toBeTruthy();
      expect(size).toBeTruthy();
    });

    it('should set flip shadow CSS variables on flipShadow', () => {
      renderer.update(90, 'next', false);

      const opacity = flipShadowEl.style.getPropertyValue('--flip-shadow-opacity');
      const width = flipShadowEl.style.getPropertyValue('--flip-shadow-width');
      const left = flipShadowEl.style.getPropertyValue('--flip-shadow-left');

      expect(opacity).toBeTruthy();
      expect(width).toBeTruthy();
      expect(left).toBeTruthy();
    });

    it('should have maximum shadow intensity at 90 degrees', () => {
      renderer.update(45, 'next', false);
      const alpha45 = parseFloat(bookEl.style.getPropertyValue('--spine-shadow-alpha'));

      renderer.update(90, 'next', false);
      const alpha90 = parseFloat(bookEl.style.getPropertyValue('--spine-shadow-alpha'));

      expect(alpha90).toBeGreaterThan(alpha45);
    });

    it('should have zero shadow intensity at 0 degrees', () => {
      renderer.update(0, 'next', false);

      const alpha = parseFloat(bookEl.style.getPropertyValue('--spine-shadow-alpha'));
      expect(alpha).toBeCloseTo(0, 1);
    });

    it('should have zero shadow intensity at 180 degrees', () => {
      renderer.update(180, 'next', false);

      const alpha = parseFloat(bookEl.style.getPropertyValue('--spine-shadow-alpha'));
      expect(alpha).toBeCloseTo(0, 1);
    });

    it('should use 50% spine position on desktop', () => {
      renderer.update(90, 'next', false);

      const left = flipShadowEl.style.getPropertyValue('--flip-shadow-left');
      expect(left).toContain('50%');
    });

    it('should use 10% spine position on mobile', () => {
      renderer.update(90, 'next', true);

      const left = flipShadowEl.style.getPropertyValue('--flip-shadow-left');
      expect(left).toContain('10%');
    });

    it('should position flip shadow differently for next vs prev', () => {
      renderer.update(90, 'next', false);
      const leftNext = flipShadowEl.style.getPropertyValue('--flip-shadow-left');

      renderer.update(90, 'prev', false);
      const leftPrev = flipShadowEl.style.getPropertyValue('--flip-shadow-left');

      expect(leftNext).not.toBe(leftPrev);
    });

    it('should handle missing book element', () => {
      mockDom.get = vi.fn((id) => {
        if (id === 'flipShadow') return flipShadowEl;
        return null;
      });

      expect(() => renderer.update(90, 'next', false)).not.toThrow();
    });

    it('should handle missing flipShadow element', () => {
      mockDom.get = vi.fn((id) => {
        if (id === 'book') return bookEl;
        return null;
      });

      expect(() => renderer.update(90, 'next', false)).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should remove spine shadow CSS variables from book', () => {
      renderer.update(90, 'next', false);
      renderer.reset();

      expect(bookEl.style.getPropertyValue('--spine-shadow-alpha')).toBe('');
      expect(bookEl.style.getPropertyValue('--spine-shadow-size')).toBe('');
    });

    it('should remove flip shadow CSS variables', () => {
      renderer.update(90, 'next', false);
      renderer.reset();

      expect(flipShadowEl.style.getPropertyValue('--flip-shadow-opacity')).toBe('');
      expect(flipShadowEl.style.getPropertyValue('--flip-shadow-width')).toBe('');
      expect(flipShadowEl.style.getPropertyValue('--flip-shadow-left')).toBe('');
    });

    it('should remove active class from flipShadow', () => {
      renderer.activate('next');
      renderer.reset();

      expect(flipShadowEl.classList.contains('active')).toBe(false);
    });

    it('should remove direction dataset from flipShadow', () => {
      renderer.activate('next');
      renderer.reset();

      expect(flipShadowEl.dataset.direction).toBeUndefined();
    });

    it('should handle missing elements gracefully', () => {
      mockDom.get = vi.fn(() => null);
      expect(() => renderer.reset()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should call reset', () => {
      const resetSpy = vi.spyOn(renderer, 'reset');
      renderer.destroy();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should null dom reference', () => {
      renderer.destroy();
      expect(renderer.dom).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      renderer.destroy();
      expect(() => renderer.destroy()).not.toThrow();
    });
  });
});
