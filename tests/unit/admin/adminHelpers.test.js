/**
 * TESTS: adminHelpers
 * Тесты для общих хелперов admin-модулей
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileAsDataURL, setupDropzone } from '../../../js/admin/modules/adminHelpers.js';

describe('adminHelpers', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // readFileAsDataURL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('readFileAsDataURL()', () => {
    it('should resolve with data URL', async () => {
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:text\/plain;base64,/);
    });

    it('should resolve with correct base64 content', async () => {
      const content = 'test content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      // Декодируем base64 часть
      const base64 = result.split(',')[1];
      expect(atob(base64)).toBe(content);
    });

    it('should handle empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:/);
    });

    it('should handle binary file', async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File([bytes], 'image.png', { type: 'image/png' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setupDropzone
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setupDropzone()', () => {
    let dropzone;
    let fileInput;
    let onFile;

    beforeEach(() => {
      dropzone = document.createElement('div');
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      onFile = vi.fn();
      setupDropzone(dropzone, fileInput, onFile);
    });

    it('should trigger file input click on dropzone click', () => {
      const clickSpy = vi.spyOn(fileInput, 'click');
      dropzone.click();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should add dragover class on dragover', () => {
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();
      dropzone.dispatchEvent(event);
      expect(dropzone.classList.contains('dragover')).toBe(true);
    });

    it('should prevent default on dragover', () => {
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();
      dropzone.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should remove dragover class on dragleave', () => {
      dropzone.classList.add('dragover');
      dropzone.dispatchEvent(new Event('dragleave'));
      expect(dropzone.classList.contains('dragover')).toBe(false);
    });

    it('should remove dragover class on drop', () => {
      dropzone.classList.add('dragover');
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(dropzone.classList.contains('dragover')).toBe(false);
    });

    it('should call onFile with dropped file', () => {
      const file = new File(['content'], 'test.txt');
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [file] };
      dropzone.dispatchEvent(event);
      expect(onFile).toHaveBeenCalledWith(file);
    });

    it('should not call onFile when no files dropped', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(onFile).not.toHaveBeenCalled();
    });

    it('should prevent default on drop', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
