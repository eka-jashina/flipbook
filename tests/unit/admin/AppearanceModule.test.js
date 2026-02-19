/**
 * TESTS: AppearanceModule
 * Тесты для модуля оформления (темы, текстуры, фон обложки)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppearanceModule } from '../../../js/admin/modules/AppearanceModule.js';

function createMockApp() {
  return {
    store: {
      getAppearance: vi.fn(() => ({
        fontMin: 14,
        fontMax: 22,
        light: {
          coverBgMode: 'default',
          coverBgStart: '#3a2d1f',
          coverBgEnd: '#2a2016',
          coverText: '#f2e9d8',
          coverBgImage: null,
          pageTexture: 'default',
          customTextureData: null,
          bgPage: '#fdfcf8',
          bgApp: '#e6e3dc',
        },
        dark: {
          coverBgMode: 'default',
          coverBgStart: '#111111',
          coverBgEnd: '#000000',
          coverText: '#eaeaea',
          coverBgImage: null,
          pageTexture: 'none',
          customTextureData: null,
          bgPage: '#1e1e1e',
          bgApp: '#121212',
        },
      })),
      updateAppearanceGlobal: vi.fn(),
      updateAppearanceTheme: vi.fn(),
      getCover: vi.fn(() => ({ title: 'О хоббитах', author: 'Толкин' })),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="appearanceThemeSwitch">
      <button class="appearance-theme-btn active" data-edit-theme="light">Light</button>
      <button class="appearance-theme-btn" data-edit-theme="dark">Dark</button>
    </div>
    <div id="pageThemeSwitch">
      <button class="appearance-theme-btn active" data-edit-theme="light">Light</button>
      <button class="appearance-theme-btn" data-edit-theme="dark">Dark</button>
    </div>
    <input id="coverBgStart" type="color" value="#3a2d1f">
    <input id="coverBgEnd" type="color" value="#2a2016">
    <input id="coverText" type="color" value="#f2e9d8">
    <div id="coverTextPreview"></div>
    <input type="hidden" id="coverBgMode" value="default">
    <button class="texture-option active" type="button" data-cover-bg="default"></button>
    <button class="texture-option" type="button" data-cover-bg="none"></button>
    <label class="texture-option texture-option--upload">
      <span id="coverBgThumb" class="texture-thumb texture-thumb--upload"></span>
      <input id="coverBgFileInput" type="file" hidden>
    </label>
    <div id="coverBgCustomInfo" hidden></div>
    <span id="coverBgCustomName"></span>
    <button id="coverBgRemove"></button>
    <input id="pageTexture" type="hidden" value="default">
    <button class="texture-option" data-texture="default"></button>
    <button class="texture-option" data-texture="none"></button>
    <div class="texture-option--upload"></div>
    <input id="textureFileInput" type="file">
    <div id="customTextureThumb"></div>
    <div id="textureCustomInfo" hidden></div>
    <span id="textureCustomName"></span>
    <button id="textureCustomRemove"></button>
    <input id="bgPage" type="color" value="#fdfcf8">
    <div id="bgPageSwatch"></div>
    <input id="bgApp" type="color" value="#e6e3dc">
    <div id="bgAppSwatch"></div>
    <input id="fontMin" type="range" min="10" max="20" value="14">
    <span id="fontMinValue">14px</span>
    <input id="fontMax" type="range" min="16" max="30" value="22">
    <span id="fontMaxValue">22px</span>
    <button id="saveAppearance"></button>
    <button id="resetAppearance"></button>
    <button id="savePlatform"></button>
  `;
}

describe('AppearanceModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new AppearanceModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize editTheme as light', () => {
      expect(mod._editTheme).toBe('light');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderAppearance()', () => {
    it('should populate global font range fields', () => {
      mod._renderAppearance();

      expect(mod.fontMin.value).toBe('14');
      expect(mod.fontMinValue.textContent).toBe('14px');
      expect(mod.fontMax.value).toBe('22');
      expect(mod.fontMaxValue.textContent).toBe('22px');
    });

    it('should load light theme fields by default', () => {
      mod._renderAppearance();

      expect(mod.coverBgStart.value).toBe('#3a2d1f');
      expect(mod.coverBgEnd.value).toBe('#2a2016');
      expect(mod.coverText.value).toBe('#f2e9d8');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _switchEditTheme
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_switchEditTheme()', () => {
    it('should save current theme and switch to dark', () => {
      mod._switchEditTheme('dark');

      expect(mod._editTheme).toBe('dark');
      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.any(Object));
    });

    it('should load dark theme fields after switching', () => {
      mod._switchEditTheme('dark');

      expect(mod.coverBgStart.value).toBe('#111111');
      expect(mod.coverBgEnd.value).toBe('#000000');
      expect(mod.coverText.value).toBe('#eaeaea');
    });

    it('should toggle active class on theme buttons', () => {
      mod._switchEditTheme('dark');

      const lightBtn = document.querySelector('[data-edit-theme="light"]');
      const darkBtn = document.querySelector('[data-edit-theme="dark"]');
      expect(lightBtn.classList.contains('active')).toBe(false);
      expect(darkBtn.classList.contains('active')).toBe(true);
    });

    it('should sync both cover and page theme switches', () => {
      mod._switchEditTheme('dark');

      const coverBtns = document.querySelectorAll('#appearanceThemeSwitch .appearance-theme-btn');
      const pageBtns = document.querySelectorAll('#pageThemeSwitch .appearance-theme-btn');

      // Cover switch synced
      expect(coverBtns[0].classList.contains('active')).toBe(false);
      expect(coverBtns[1].classList.contains('active')).toBe(true);

      // Page switch synced
      expect(pageBtns[0].classList.contains('active')).toBe(false);
      expect(pageBtns[1].classList.contains('active')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _updateAppearancePreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_updateAppearancePreview()', () => {
    it('should set gradient background and text color', () => {
      mod.coverBgStart.value = '#ff0000';
      mod.coverBgEnd.value = '#0000ff';
      mod.coverText.value = '#ffffff';

      mod._updateAppearancePreview();

      expect(mod.coverTextPreview.style.background).toContain('linear-gradient');
      expect(mod.coverTextPreview.style.color).toBe('rgb(255, 255, 255)');
    });

    it('should show book title in preview', () => {
      mod._updateAppearancePreview();
      expect(mod.coverTextPreview.textContent).toBe('О хоббитах');
    });

    it('should show fallback text if no title', () => {
      app.store.getCover.mockReturnValue({ title: '', author: '' });
      mod._updateAppearancePreview();
      expect(mod.coverTextPreview.textContent).toBe('Заголовок');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderCoverBgSelector
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderCoverBgSelector()', () => {
    it('should mark default option as active', () => {
      mod._renderCoverBgSelector('default', null);

      const defaultBtn = document.querySelector('[data-cover-bg="default"]');
      const noneBtn = document.querySelector('[data-cover-bg="none"]');
      expect(defaultBtn.classList.contains('active')).toBe(true);
      expect(noneBtn.classList.contains('active')).toBe(false);
      expect(mod.coverBgMode.value).toBe('default');
      expect(mod.coverBgCustomInfo.hidden).toBe(true);
    });

    it('should mark none option as active', () => {
      mod._renderCoverBgSelector('none', null);

      const defaultBtn = document.querySelector('[data-cover-bg="default"]');
      const noneBtn = document.querySelector('[data-cover-bg="none"]');
      expect(defaultBtn.classList.contains('active')).toBe(false);
      expect(noneBtn.classList.contains('active')).toBe(true);
      expect(mod.coverBgMode.value).toBe('none');
    });

    it('should show custom info when custom data provided', () => {
      mod._renderCoverBgSelector('custom', 'data:image/png;base64,abc');

      expect(mod.coverBgThumb.classList.contains('has-image')).toBe(true);
      expect(mod.coverBgCustomInfo.hidden).toBe(false);
      expect(mod.coverBgMode.value).toBe('custom');
    });

    it('should hide custom info when no custom data', () => {
      mod._renderCoverBgSelector('default', null);

      expect(mod.coverBgThumb.classList.contains('has-image')).toBe(false);
      expect(mod.coverBgCustomInfo.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleCoverBgUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleCoverBgUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleCoverBgUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
    });

    it('should reject non-image files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      mod._handleCoverBgUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только изображения');
    });

    it('should upload valid image and update store', () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:image/png;base64,abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleCoverBgUpload(event);

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        coverBgMode: 'custom',
        coverBgImage: 'data:image/png;base64,abc',
      });
      expect(app._showToast).toHaveBeenCalledWith('Фон обложки загружен');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeCoverBg
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeCoverBg()', () => {
    it('should reset cover background to default in store', () => {
      mod._removeCoverBg();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        coverBgMode: 'default',
        coverBgImage: null,
      });
      expect(app._showToast).toHaveBeenCalledWith('Своё изображение удалено');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleTextureUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleTextureUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'image/png' }], value: 'tex.png' },
      };

      mod._handleTextureUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
    });

    it('should reject non-image files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'text/plain' }], value: 'file.txt' },
      };

      mod._handleTextureUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только изображения');
    });

    it('should upload custom texture and set to custom mode', () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:image/png;base64,tex';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'tex.png' },
      };

      mod._handleTextureUpload(event);

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        pageTexture: 'custom',
        customTextureData: 'data:image/png;base64,tex',
      });
      expect(mod.pageTexture.value).toBe('custom');
      expect(app._showToast).toHaveBeenCalledWith('Текстура загружена');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeCustomTexture
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeCustomTexture()', () => {
    it('should reset texture to default', () => {
      mod._removeCustomTexture();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        pageTexture: 'default',
        customTextureData: null,
      });
      expect(mod.pageTexture.value).toBe('default');
      expect(app._showToast).toHaveBeenCalledWith('Своя текстура удалена');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveAppearance (now only saves per-theme data)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveAppearance()', () => {
    it('should save current theme form data', () => {
      mod.coverBgStart.value = '#ff0000';
      mod.coverBgEnd.value = '#00ff00';
      mod.coverText.value = '#0000ff';
      mod.pageTexture.value = 'default';
      mod.bgPage.value = '#ffffff';
      mod.bgApp.value = '#000000';

      mod._saveAppearance();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        coverBgMode: 'default',
        coverBgStart: '#ff0000',
        coverBgEnd: '#00ff00',
        coverText: '#0000ff',
        coverBgImage: null,
        pageTexture: 'default',
        customTextureData: null,
        bgPage: '#ffffff',
        bgApp: '#000000',
      });
      expect(app._showToast).toHaveBeenCalledWith('Оформление сохранено');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _savePlatform (saves fontMin/fontMax)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_savePlatform()', () => {
    it('should save global fontMin/fontMax', () => {
      mod.fontMin.value = '12';
      mod.fontMax.value = '26';

      mod._savePlatform();

      expect(app.store.updateAppearanceGlobal).toHaveBeenCalledWith({
        fontMin: 12,
        fontMax: 26,
      });
      expect(app._showToast).toHaveBeenCalledWith('Настройки платформы сохранены');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetAppearance()', () => {
    it('should reset per-theme values', () => {
      mod._resetAppearance();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.objectContaining({
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
        coverBgImage: null,
        pageTexture: 'default',
        bgPage: '#fdfcf8',
        bgApp: '#e6e3dc',
      }));

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('dark', expect.objectContaining({
        coverBgStart: '#111111',
        coverBgEnd: '#000000',
        coverText: '#eaeaea',
        pageTexture: 'none',
        bgPage: '#1e1e1e',
        bgApp: '#121212',
      }));

      expect(app._showToast).toHaveBeenCalledWith('Оформление сброшено');
    });
  });
});
