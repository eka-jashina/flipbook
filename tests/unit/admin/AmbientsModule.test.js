/**
 * TESTS: AmbientsModule
 * Тесты для модуля управления атмосферными звуками
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AmbientsModule } from '../../../js/admin/modules/AmbientsModule.js';

function createMockApp() {
  return {
    store: {
      getAmbients: vi.fn(() => [
        { id: 'none', label: 'Без звука', icon: '✕', file: null, visible: true, builtin: true },
        { id: 'rain', label: 'Дождь', icon: '🌧️', file: 'sounds/ambient/rain.mp3', visible: true, builtin: true },
        { id: 'custom1', label: 'Океан', icon: '🌊', file: 'ocean.mp3', visible: true, builtin: false },
      ]),
      addAmbient: vi.fn(),
      updateAmbient: vi.fn(),
      removeAmbient: vi.fn(),
    },
    settings: { render: vi.fn() },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="ambientCards"></div>
    <button id="addAmbient"></button>
    <dialog id="ambientModal">
      <h2 id="ambientModalTitle"></h2>
      <form id="ambientForm">
        <input id="ambientLabel" type="text">
        <input id="ambientIcon" type="text">
        <input id="ambientFile" type="text">
        <input id="ambientFileUpload" type="file">
        <span id="ambientUploadLabel"></span>
        <button id="cancelAmbientModal" type="button"></button>
      </form>
    </dialog>
  `;
}

describe('AmbientsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    document.querySelectorAll('dialog').forEach(d => {
      d.showModal = d.showModal || vi.fn();
      d.close = d.close || vi.fn();
    });
    app = createMockApp();
    mod = new AmbientsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize editing state as null', () => {
      expect(mod._editingAmbientIndex).toBeNull();
      expect(mod._pendingAmbientDataUrl).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderAmbients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderAmbients()', () => {
    it('should render ambient cards from store', () => {
      mod._renderAmbients();

      const cards = mod.ambientCards.querySelectorAll('.ambient-card');
      expect(cards.length).toBe(3);
    });

    it('should show toggle for non-none ambients', () => {
      mod._renderAmbients();

      const toggles = mod.ambientCards.querySelectorAll('[data-ambient-toggle]');
      // 'none' has no toggle, rain and custom1 have toggles
      expect(toggles.length).toBe(2);
    });

    it('should show edit/delete buttons for custom ambients only', () => {
      mod._renderAmbients();

      const editBtns = mod.ambientCards.querySelectorAll('[data-ambient-edit]');
      const deleteBtns = mod.ambientCards.querySelectorAll('[data-ambient-delete]');
      // Only custom1 is non-builtin
      expect(editBtns.length).toBe(1);
      expect(deleteBtns.length).toBe(1);
    });

    it('should show "Загруженный файл" for data URL files', () => {
      app.store.getAmbients.mockReturnValue([
        { id: 'test', label: 'Test', icon: '🎵', file: 'data:audio/mp3;base64,abc', visible: true, builtin: false },
      ]);

      mod._renderAmbients();

      const meta = mod.ambientCards.querySelector('.ambient-card-meta');
      expect(meta.textContent).toBe('Загруженный файл');
    });

    it('should show "Нет файла" when file is null', () => {
      app.store.getAmbients.mockReturnValue([
        { id: 'none', label: 'Без звука', icon: '✕', file: null, visible: true, builtin: true },
      ]);

      mod._renderAmbients();

      const meta = mod.ambientCards.querySelector('.ambient-card-meta');
      expect(meta.textContent).toBe('Нет файла');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _openAmbientModal
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_openAmbientModal()', () => {
    it('should open modal for new ambient', () => {
      const showModalSpy = vi.spyOn(mod.ambientModal, 'showModal');

      mod._openAmbientModal();

      expect(mod._editingAmbientIndex).toBeNull();
      expect(mod.ambientModalTitle.textContent).toBe('Добавить атмосферу');
      expect(showModalSpy).toHaveBeenCalled();
    });

    it('should open modal for editing existing ambient', () => {
      mod._openAmbientModal(2); // custom1

      expect(mod._editingAmbientIndex).toBe(2);
      expect(mod.ambientModalTitle.textContent).toBe('Редактировать атмосферу');
      expect(mod.ambientLabelInput.value).toBe('Океан');
      expect(mod.ambientIconInput.value).toBe('🌊');
      expect(mod.ambientFileInput.value).toBe('ocean.mp3');
    });

    it('should show file label for data URL in edit mode', () => {
      app.store.getAmbients.mockReturnValue([
        { id: 'test', label: 'Test', icon: '🎵', file: 'data:audio/mp3;base64,abc', visible: true, builtin: false },
      ]);

      mod._openAmbientModal(0);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,abc');
      expect(mod.ambientUploadLabel.textContent).toBe('Файл загружен');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleAmbientFileUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleAmbientFileUpload()', () => {
    it('should reject files over 5MB', () => {
      const event = {
        target: { files: [{ size: 6 * 1024 * 1024, type: 'audio/mp3' }], value: 'big.mp3' },
      };

      mod._handleAmbientFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 5 МБ)');
    });

    it('should reject non-audio files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleAmbientFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только аудиофайлы');
    });

    it('should store data URL and update label on success', () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:audio/mp3;base64,xyz';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3', name: 'ambient.mp3' }], value: 'ambient.mp3' },
      };

      mod._handleAmbientFileUpload(event);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,xyz');
      expect(mod.ambientUploadLabel.textContent).toBe('ambient.mp3');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleAmbientSubmit
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleAmbientSubmit()', () => {
    it('should add new ambient to store', () => {
      mod.ambientLabelInput.value = 'Лес';
      mod.ambientIconInput.value = '🌲';
      mod.ambientFileInput.value = 'forest.mp3';
      vi.spyOn(mod.ambientModal, 'close');

      const event = { preventDefault: vi.fn() };
      mod._handleAmbientSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(app.store.addAmbient).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Лес',
          icon: '🌲',
          file: 'forest.mp3',
          visible: true,
          builtin: false,
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Атмосфера добавлена');
    });

    it('should update existing ambient in edit mode', () => {
      mod._editingAmbientIndex = 2;
      mod.ambientLabelInput.value = 'Океан обновлённый';
      mod.ambientIconInput.value = '🌊';
      mod.ambientFileInput.value = 'ocean2.mp3';
      vi.spyOn(mod.ambientModal, 'close');

      const event = { preventDefault: vi.fn() };
      mod._handleAmbientSubmit(event);

      expect(app.store.updateAmbient).toHaveBeenCalledWith(2,
        expect.objectContaining({
          id: 'custom1',
          label: 'Океан обновлённый',
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Атмосфера обновлена');
    });

    it('should truncate shortLabel to 8 characters', () => {
      mod.ambientLabelInput.value = 'Очень длинное название';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = 'file.mp3';

      mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      const ambient = app.store.addAmbient.mock.calls[0][0];
      expect(ambient.shortLabel).toBe('Очень дл');
      expect(ambient.shortLabel.length).toBeLessThanOrEqual(8);
    });

    it('should reject if label or icon is empty', () => {
      mod.ambientLabelInput.value = '';
      mod.ambientIconInput.value = '';

      mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      expect(app.store.addAmbient).not.toHaveBeenCalled();
    });

    it('should reject if no file provided', () => {
      mod.ambientLabelInput.value = 'Test';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = '';
      mod._pendingAmbientDataUrl = null;

      mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      expect(app._showToast).toHaveBeenCalledWith('Укажите путь к файлу или загрузите аудио');
      expect(app.store.addAmbient).not.toHaveBeenCalled();
    });

    it('should prefer pending data URL over file path', () => {
      mod.ambientLabelInput.value = 'Test';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = 'path.mp3';
      mod._pendingAmbientDataUrl = 'data:audio/mp3;base64,abc';

      mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      const ambient = app.store.addAmbient.mock.calls[0][0];
      expect(ambient.file).toBe('data:audio/mp3;base64,abc');
    });
  });
});
