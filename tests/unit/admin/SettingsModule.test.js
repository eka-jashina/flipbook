/**
 * TESTS: SettingsModule
 * Тесты для модуля настроек по умолчанию и видимости
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsModule } from '../../../js/admin/modules/SettingsModule.js';

function createMockApp() {
  return {
    store: {
      getDefaultSettings: vi.fn(() => ({
        font: 'georgia',
        fontSize: 18,
        theme: 'light',
        soundEnabled: true,
        soundVolume: 0.3,
        ambientType: 'none',
        ambientVolume: 0.5,
      })),
      updateDefaultSettings: vi.fn(),
      getAmbients: vi.fn(() => [
        { id: 'none', label: 'Без звука', shortLabel: 'Без', icon: '✕', visible: true },
        { id: 'rain', label: 'Дождь', shortLabel: 'Дождь', icon: '🌧️', visible: true },
        { id: 'fireplace', label: 'Камин', shortLabel: 'Камин', icon: '🔥', visible: false },
      ]),
      getSettingsVisibility: vi.fn(() => ({
        fontSize: true,
        theme: true,
        font: true,
        fullscreen: true,
        sound: true,
        ambient: true,
      })),
      updateSettingsVisibility: vi.fn(),
      getReadingFonts: vi.fn(() => [
        { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
        { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true },
        { id: 'disabled', label: 'Disabled', family: 'Disabled', builtin: true, enabled: false },
      ]),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <select id="defaultFont">
      <option value="georgia">Georgia</option>
      <option value="inter">Inter</option>
    </select>
    <input id="defaultFontSize" type="range" min="14" max="22" value="18">
    <span id="fontSizeValue">18px</span>
    <div id="defaultTheme">
      <button class="setting-theme-btn" data-theme="light">Light</button>
      <button class="setting-theme-btn" data-theme="dark">Dark</button>
    </div>
    <input id="defaultSound" type="checkbox" checked>
    <span id="soundLabel">Включён</span>
    <input id="defaultVolume" type="range" min="0" max="100" value="30">
    <span id="volumeValue">30%</span>
    <div id="defaultAmbient"></div>
    <button id="saveSettings"></button>
    <button id="resetSettings"></button>
    <div id="visibilityToggles">
      <input data-visibility="fontSize" type="checkbox">
      <input data-visibility="theme" type="checkbox">
      <input data-visibility="font" type="checkbox">
      <input data-visibility="fullscreen" type="checkbox">
      <input data-visibility="sound" type="checkbox">
      <input data-visibility="ambient" type="checkbox">
    </div>
  `;
}

describe('SettingsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new SettingsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderSettings()', () => {
    it('should populate form with default settings', () => {
      mod._renderSettings();

      expect(mod.defaultFont.value).toBe('georgia');
      expect(mod.defaultFontSize.value).toBe('18');
      expect(mod.fontSizeValue.textContent).toBe('18px');
      expect(mod.defaultSound.checked).toBe(true);
      expect(mod.soundLabel.textContent).toBe('Включён');
      expect(mod.volumeValue.textContent).toBe('30%');
    });

    it('should set active theme button', () => {
      mod._renderSettings();

      const lightBtn = document.querySelector('[data-theme="light"]');
      const darkBtn = document.querySelector('[data-theme="dark"]');
      expect(lightBtn.classList.contains('active')).toBe(true);
      expect(darkBtn.classList.contains('active')).toBe(false);
    });

    it('should render only visible ambient buttons', () => {
      mod._renderSettings();

      const buttons = mod.defaultAmbientGroup.querySelectorAll('.setting-ambient-btn');
      // 'fireplace' is not visible, so only 2
      expect(buttons.length).toBe(2);
    });

    it('should mark active ambient button', () => {
      mod._renderSettings();

      const activeBtn = mod.defaultAmbientGroup.querySelector('.setting-ambient-btn.active');
      expect(activeBtn).not.toBeNull();
      expect(activeBtn.dataset.ambient).toBe('none');
    });

    it('should show "Выключен" when sound disabled', () => {
      app.store.getDefaultSettings.mockReturnValue({
        font: 'georgia', fontSize: 18, theme: 'light',
        soundEnabled: false, soundVolume: 0.3, ambientType: 'none', ambientVolume: 0.5,
      });

      mod._renderSettings();

      expect(mod.soundLabel.textContent).toBe('Выключен');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderSettingsVisibility
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderSettingsVisibility()', () => {
    it('should set checkbox states from store', () => {
      app.store.getSettingsVisibility.mockReturnValue({
        fontSize: false, theme: true, font: true,
        fullscreen: false, sound: true, ambient: true,
      });

      mod._renderSettingsVisibility();

      const fontSizeToggle = document.querySelector('[data-visibility="fontSize"]');
      const themeToggle = document.querySelector('[data-visibility="theme"]');
      expect(fontSizeToggle.checked).toBe(false);
      expect(themeToggle.checked).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveSettings()', () => {
    it('should save settings from form to store', () => {
      mod._renderSettings();

      mod.defaultFont.value = 'inter';
      mod.defaultFontSize.value = '20';
      mod.defaultSound.checked = false;
      mod.defaultVolume.value = '50';

      mod._saveSettings();

      expect(app.store.updateDefaultSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          font: 'inter',
          fontSize: 20,
          soundEnabled: false,
          soundVolume: 0.5,
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Настройки сохранены');
    });

    it('should convert volume from percentage to decimal', () => {
      mod._renderSettings();
      mod.defaultVolume.value = '75';

      mod._saveSettings();

      const call = app.store.updateDefaultSettings.mock.calls[0][0];
      expect(call.soundVolume).toBe(0.75);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetSettings()', () => {
    it('should reset to default settings', () => {
      mod._resetSettings();

      expect(app.store.updateDefaultSettings).toHaveBeenCalledWith({
        font: 'georgia',
        fontSize: 18,
        theme: 'light',
        soundEnabled: true,
        soundVolume: 0.3,
        ambientType: 'none',
        ambientVolume: 0.5,
      });

      expect(app.store.updateSettingsVisibility).toHaveBeenCalledWith({
        fontSize: true, theme: true, font: true,
        fullscreen: true, sound: true, ambient: true,
      });

      expect(app._showToast).toHaveBeenCalledWith('Настройки сброшены');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateFontSelect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateFontSelect()', () => {
    it('should populate select with enabled fonts only', () => {
      mod.updateFontSelect();

      const options = mod.defaultFont.querySelectorAll('option');
      expect(options.length).toBe(2); // georgia, inter (disabled is excluded)
      expect(options[0].value).toBe('georgia');
      expect(options[1].value).toBe('inter');
    });

    it('should preserve current selection if font still exists', () => {
      mod.defaultFont.value = 'georgia';
      mod.updateFontSelect();
      // georgia still enabled — value preserved
      expect(mod.defaultFont.value).toBe('georgia');
    });

    it('should fallback to first font if current is removed', () => {
      mod.defaultFont.value = 'nonexistent';
      mod.updateFontSelect();
      expect(mod.defaultFont.value).toBe('georgia');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // bindEvents — visibility toggles
  // ═══════════════════════════════════════════════════════════════════════════

  describe('visibility toggle events', () => {
    it('should update store on visibility change', () => {
      const fontSizeToggle = document.querySelector('[data-visibility="fontSize"]');
      fontSizeToggle.checked = false;
      fontSizeToggle.dispatchEvent(new Event('change', { bubbles: true }));

      expect(app.store.updateSettingsVisibility).toHaveBeenCalledWith({ fontSize: false });
    });
  });
});
