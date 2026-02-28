/**
 * INTEGRATION TEST: Theme & Appearance
 * Тестирование ThemeController + SettingsManager + CONFIG.APPEARANCE:
 * переключение тем, применение CSS-переменных, видимость секций настроек.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { ThemeController } from '../../../js/core/delegates/ThemeController.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

// Mock CONFIG with appearance data
vi.mock('../../../js/config.js', () => ({
  CONFIG: {
    APPEARANCE: {
      coverTitle: 'Test Book',
      coverAuthor: 'Test Author',
      fontMin: 14,
      fontMax: 22,
      light: {
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
        pageTexture: 'default',
        bgPage: '#fdfcf8',
        bgApp: '#e6e3dc',
      },
      dark: {
        coverBgStart: '#1a1a2e',
        coverBgEnd: '#16213e',
        coverText: '#e0e0e0',
        pageTexture: 'none',
        bgPage: '#1e1e1e',
        bgApp: '#121212',
      },
    },
    SETTINGS_VISIBILITY: {
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: false,
      sound: true,
      ambient: false,
    },
  },
}));

// Mock utils
vi.mock('../../../js/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    announce: vi.fn(),
    isValidTheme: (t) => ['light', 'dark', 'bw'].includes(t),
    isValidCSSColor: (c) => typeof c === 'string' && c.startsWith('#'),
    isValidFontSize: (s) => typeof s === 'number' && s >= 8 && s <= 72,
  };
});

describe('Theme & Appearance Integration', () => {
  let dom;
  let settingsManager;
  let themeController;
  let htmlElement;

  beforeEach(() => {
    dom = createFullBookDOM();

    htmlElement = document.documentElement;

    const storageMock = {
      load: vi.fn(() => ({})),
      save: vi.fn(),
    };

    settingsManager = new SettingsManager(storageMock, {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    const mockDom = {
      get: (id) => {
        if (id === 'html') return htmlElement;
        if (id === 'cover') return dom.cover;
        return dom[id] || null;
      },
    };

    themeController = new ThemeController({
      dom: mockDom,
      settings: settingsManager,
    });
  });

  afterEach(() => {
    settingsManager?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Theme application', () => {
    it('should apply light theme (empty dataset)', () => {
      settingsManager.set('theme', 'light');
      themeController.apply();

      expect(htmlElement.dataset.theme).toBe('');
    });

    it('should apply dark theme', () => {
      settingsManager.set('theme', 'dark');
      themeController.apply();

      expect(htmlElement.dataset.theme).toBe('dark');
    });

    it('should apply bw theme', () => {
      settingsManager.set('theme', 'bw');
      themeController.apply();

      expect(htmlElement.dataset.theme).toBe('bw');
    });

    it('should fallback to light for invalid theme', () => {
      settingsManager.set('theme', 'invalid-theme');
      themeController.apply();

      expect(htmlElement.dataset.theme).toBe('');
    });
  });

  describe('Theme switching via handleTheme', () => {
    it('should switch from light to dark', () => {
      themeController.apply();
      expect(htmlElement.dataset.theme).toBe('');

      themeController.handleTheme('dark');
      expect(htmlElement.dataset.theme).toBe('dark');
    });

    it('should switch from dark to bw', () => {
      settingsManager.set('theme', 'dark');
      themeController.apply();

      themeController.handleTheme('bw');
      expect(htmlElement.dataset.theme).toBe('bw');
    });

    it('should handle invalid theme by falling back to light', () => {
      themeController.handleTheme('<script>alert(1)</script>');
      expect(htmlElement.dataset.theme).toBe('');
    });
  });

  describe('Appearance CSS variables', () => {
    it('should set cover gradient for light theme', () => {
      settingsManager.set('theme', 'light');
      themeController.apply();

      const bg = htmlElement.style.getPropertyValue('--cover-front-bg');
      expect(bg).toContain('linear-gradient');
      expect(bg).toContain('#3a2d1f');
      expect(bg).toContain('#2a2016');
    });

    it('should set cover text color', () => {
      themeController.apply();

      const color = htmlElement.style.getPropertyValue('--cover-front-text');
      expect(color).toBe('#f2e9d8');
    });

    it('should set page background color', () => {
      themeController.apply();

      const bgPage = htmlElement.style.getPropertyValue('--bg-page');
      expect(bgPage).toBe('#fdfcf8');
    });

    it('should set app background color', () => {
      themeController.apply();

      const bgApp = htmlElement.style.getPropertyValue('--bg-app');
      expect(bgApp).toBe('#e6e3dc');
    });

    it('should set font size limits', () => {
      themeController.apply();

      expect(htmlElement.style.getPropertyValue('--font-min')).toBe('14px');
      expect(htmlElement.style.getPropertyValue('--font-max')).toBe('22px');
    });

    it('should switch appearance when theme changes to dark', () => {
      settingsManager.set('theme', 'dark');
      themeController.apply();

      const bgPage = htmlElement.style.getPropertyValue('--bg-page');
      expect(bgPage).toBe('#1e1e1e');

      const bgApp = htmlElement.style.getPropertyValue('--bg-app');
      expect(bgApp).toBe('#121212');
    });

    it('should set page texture to none for dark theme', () => {
      settingsManager.set('theme', 'dark');
      themeController.apply();

      const texture = htmlElement.style.getPropertyValue('--bg-page-image');
      expect(texture).toBe('none');
    });
  });

  describe('Settings visibility', () => {
    it('should hide sections based on SETTINGS_VISIBILITY config', () => {
      // Create setting sections
      const sections = ['fontSize', 'theme', 'font', 'fullscreen', 'sound', 'ambient'];
      sections.forEach(key => {
        const el = document.createElement('div');
        el.className = 'settings-section';
        el.dataset.setting = key;
        document.body.appendChild(el);
      });

      themeController.apply();

      // fullscreen and ambient should be hidden
      const fullscreenEl = document.querySelector('[data-setting="fullscreen"]');
      const ambientEl = document.querySelector('[data-setting="ambient"]');
      expect(fullscreenEl.hidden).toBe(true);
      expect(ambientEl.hidden).toBe(true);

      // fontSize, theme, font, sound should be visible
      const fontSizeEl = document.querySelector('[data-setting="fontSize"]');
      const themeEl = document.querySelector('[data-setting="theme"]');
      expect(fontSizeEl.hidden).toBe(false);
      expect(themeEl.hidden).toBe(false);
    });

    it('should hide settings-pod if all sections hidden', () => {
      // Create settings pod with only hidden sections
      const pod = document.createElement('div');
      pod.className = 'settings-pod';

      const section = document.createElement('div');
      section.className = 'settings-section';
      section.dataset.setting = 'fullscreen';
      pod.appendChild(section);
      document.body.appendChild(pod);

      themeController.apply();

      expect(pod.hidden).toBe(true);
    });

    it('should show settings-pod if has visible sections', () => {
      const pod = document.createElement('div');
      pod.className = 'settings-pod';

      const section = document.createElement('div');
      section.className = 'settings-section';
      section.dataset.setting = 'fontSize';
      pod.appendChild(section);
      document.body.appendChild(pod);

      themeController.apply();

      expect(pod.hidden).toBe(false);
    });
  });

  describe('Theme + settings roundtrip', () => {
    it('should persist theme through settings and restore', () => {
      // Set theme
      settingsManager.set('theme', 'dark');
      themeController.apply();
      expect(htmlElement.dataset.theme).toBe('dark');

      // Simulate "save and restore"
      const savedTheme = settingsManager.get('theme');
      expect(savedTheme).toBe('dark');

      // Create new controller with saved settings
      settingsManager.set('theme', savedTheme);
      themeController.apply();
      expect(htmlElement.dataset.theme).toBe('dark');
    });

    it('should cycle through all themes correctly', () => {
      const themes = ['light', 'dark', 'bw', 'light'];
      const expected = ['', 'dark', 'bw', ''];

      themes.forEach((theme, i) => {
        themeController.handleTheme(theme);
        expect(htmlElement.dataset.theme).toBe(expected[i]);
      });
    });
  });
});
