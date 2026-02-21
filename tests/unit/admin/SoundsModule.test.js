/**
 * TESTS: SoundsModule
 * Тесты для модуля управления звуками
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoundsModule } from '../../../js/admin/modules/SoundsModule.js';

function createMockApp() {
  return {
    store: {
      getSounds: vi.fn(() => ({
        pageFlip: 'sounds/page-flip.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      })),
      updateSounds: vi.fn(),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="soundCardsGrid"></div>
    <button id="saveSounds"></button>
    <button id="resetSounds"></button>
  `;
}

describe('SoundsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new SoundsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cacheDOM
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheDOM()', () => {
    it('should generate sound cards and cache DOM elements', () => {
      expect(mod._fields.pageFlip).toBe(document.getElementById('sound-pageFlip'));
      expect(mod._fields.bookOpen).toBe(document.getElementById('sound-bookOpen'));
      expect(mod._fields.bookClose).toBe(document.getElementById('sound-bookClose'));
      expect(mod._uploads.pageFlip).toBe(document.getElementById('sound-pageFlip-upload'));
      expect(mod._hints.pageFlip).toBe(document.getElementById('sound-pageFlip-hint'));
      expect(mod.saveSoundsBtn).toBe(document.getElementById('saveSounds'));
      expect(mod.resetSoundsBtn).toBe(document.getElementById('resetSounds'));
    });

    it('should generate 3 sound cards in the grid', () => {
      const cards = document.querySelectorAll('#soundCardsGrid .setting-card');
      expect(cards.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderSounds()', () => {
    it('should populate inputs with store sounds', () => {
      mod._renderSounds();

      expect(mod._fields.pageFlip.value).toBe('sounds/page-flip.mp3');
      expect(mod._fields.bookOpen.value).toBe('sounds/cover-flip.mp3');
      expect(mod._fields.bookClose.value).toBe('sounds/cover-flip.mp3');
    });

    it('should show default hint for file paths', () => {
      mod._renderSounds();

      expect(mod._hints.pageFlip.textContent).toBe('Дефолт: sounds/page-flip.mp3');
      expect(mod._hints.bookOpen.textContent).toBe('Дефолт: sounds/cover-flip.mp3');
    });

    it('should show "Загруженный файл" hint for data URLs', () => {
      app.store.getSounds.mockReturnValue({
        pageFlip: 'data:audio/mp3;base64,abc',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });

      mod._renderSounds();

      expect(mod._fields.pageFlip.value).toBe('');
      expect(mod._hints.pageFlip.textContent).toBe('Загруженный файл');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleSoundUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleSoundUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      mod._handleSoundUpload(event, 'pageFlip');

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
      expect(event.target.value).toBe('');
    });

    it('should reject non-audio files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleSoundUpload(event, 'pageFlip');

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только аудиофайлы');
    });

    it('should upload valid audio file via FileReader', () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:audio/mp3;base64,abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      mod._handleSoundUpload(event, 'pageFlip');

      expect(app.store.updateSounds).toHaveBeenCalledWith({ pageFlip: 'data:audio/mp3;base64,abc' });
      expect(app._showToast).toHaveBeenCalledWith('Звук загружен');
      expect(event.target.value).toBe('');

      global.FileReader = OriginalFileReader;
    });

    it('should do nothing if no file selected', () => {
      const event = { target: { files: [] } };
      mod._handleSoundUpload(event, 'pageFlip');
      expect(app.store.updateSounds).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveSounds()', () => {
    it('should save input values to store', () => {
      mod._fields.pageFlip.value = 'custom/flip.mp3';
      mod._fields.bookOpen.value = 'custom/open.mp3';
      mod._fields.bookClose.value = '';

      mod._saveSounds();

      expect(app.store.updateSounds).toHaveBeenCalledWith({
        pageFlip: 'custom/flip.mp3',
        bookOpen: 'custom/open.mp3',
        bookClose: 'sounds/cover-flip.mp3', // Fallback to current
      });
      expect(app._showToast).toHaveBeenCalledWith('Звуки сохранены');
    });

    it('should keep current values for empty inputs', () => {
      mod._fields.pageFlip.value = '';
      mod._fields.bookOpen.value = '';
      mod._fields.bookClose.value = '';

      mod._saveSounds();

      expect(app.store.updateSounds).toHaveBeenCalledWith({
        pageFlip: 'sounds/page-flip.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetSounds()', () => {
    it('should reset to default sound paths', () => {
      mod._resetSounds();

      expect(app.store.updateSounds).toHaveBeenCalledWith({
        pageFlip: 'sounds/page-flip.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });
      expect(app._showToast).toHaveBeenCalledWith('Звуки сброшены');
    });
  });
});
