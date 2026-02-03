/**
 * E2E TESTS: SETTINGS
 * Font, theme, sound, and ambient settings tests
 */

import { test, expect, clearStorage, setStoredSettings, getStoredSettings, testData } from '../fixtures/book.fixture.js';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FONT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Font Settings', () => {
    test('should open and close settings panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await settings.isOpen()).toBe(false);

      await settings.open();
      expect(await settings.isOpen()).toBe(true);

      await settings.close();
      expect(await settings.isOpen()).toBe(false);
    });

    test('should increase font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      const sizeBefore = await settings.getFontSize();

      await settings.increaseFontSize();
      const sizeAfter = await settings.getFontSize();

      expect(sizeAfter).toBe(sizeBefore + 1);
    });

    test('should decrease font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // First increase to ensure we can decrease
      await settings.increaseFontSize();
      const sizeBefore = await settings.getFontSize();

      await settings.decreaseFontSize();
      const sizeAfter = await settings.getFontSize();

      expect(sizeAfter).toBe(sizeBefore - 1);
    });

    test('should not exceed max font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFontSize(testData.fontSizes.max);
      await settings.increaseFontSize();

      const size = await settings.getFontSize();
      expect(size).toBe(testData.fontSizes.max);
    });

    test('should not go below min font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFontSize(testData.fontSizes.min);
      await settings.decreaseFontSize();

      const size = await settings.getFontSize();
      expect(size).toBe(testData.fontSizes.min);
    });

    test('should change font family', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFont('merriweather');

      // Verify font is applied to content
      const fontFamily = await page.locator('.page-content').evaluate(el =>
        getComputedStyle(el).fontFamily
      );
      expect(fontFamily.toLowerCase()).toContain('merriweather');
    });

    test('font size change should repaginate', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pagesBefore = await bookPage.getTotalPages();

      // Increase font size significantly
      await settings.setFontSize(testData.fontSizes.max);

      const pagesAfter = await bookPage.getTotalPages();

      // More pages with larger font
      expect(pagesAfter).toBeGreaterThanOrEqual(pagesBefore);
    });

    test('font settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFont('literata');
      await settings.setFontSize(20);

      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getFont()).toBe('literata');
      expect(await settings.getFontSize()).toBe(20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Theme Settings', () => {
    test('should switch to dark theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('dark');
    });

    test('should switch to bw theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('bw');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('bw');
    });

    test('should switch back to light theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');
      await settings.setTheme('light');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('light');
    });

    test('theme buttons should show active state', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Initially light is active
      expect(await settings.isThemeActive('light')).toBe(true);
      expect(await settings.isThemeActive('dark')).toBe(false);

      // Switch to dark
      await settings.setTheme('dark');
      expect(await settings.isThemeActive('light')).toBe(false);
      expect(await settings.isThemeActive('dark')).toBe(true);
    });

    test('theme should persist after reload', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');

      await page.reload();
      await page.waitForLoadState('networkidle');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('dark');
    });

    test('theme should apply correct colors', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Light theme
      await settings.setTheme('light');
      const lightBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim()
      );

      // Dark theme
      await settings.setTheme('dark');
      const darkBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim()
      );

      // Colors should be different
      expect(lightBg).not.toBe(darkBg);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Sound Settings', () => {
    test('should toggle sound on/off', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Initially enabled
      expect(await settings.isSoundEnabled()).toBe(true);

      // Disable
      await settings.toggleSound();
      expect(await settings.isSoundEnabled()).toBe(false);

      // Enable again
      await settings.toggleSound();
      expect(await settings.isSoundEnabled()).toBe(true);
    });

    test('volume control should be disabled when sound is off', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      await settings.disableSound();

      const volumeControl = page.locator('.page-volume-control');
      await expect(volumeControl).toHaveClass(/disabled/);
    });

    test('should adjust sound volume', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      await settings.setSoundVolume(75);

      const volume = await settings.getSoundVolume();
      expect(volume).toBe(75);
    });

    test('sound settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.disableSound();
      await settings.setSoundVolume(25);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.isSoundEnabled()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Ambient Settings', () => {
    test('should select ambient type', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');

      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('should show volume slider when ambient is active', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Initially no ambient
      await settings.setAmbientType('none');
      expect(await settings.isAmbientVolumeVisible()).toBe(false);

      // Select ambient
      await settings.setAmbientType('fireplace');
      expect(await settings.isAmbientVolumeVisible()).toBe(true);
    });

    test('should hide volume slider when ambient is none', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');
      await settings.setAmbientType('none');

      expect(await settings.isAmbientVolumeVisible()).toBe(false);
    });

    test('should adjust ambient volume', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('cafe');
      await settings.setAmbientVolume(60);

      expect(await settings.getAmbientVolume()).toBe(60);
    });

    test('ambient settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');
      await settings.setAmbientVolume(40);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('switching ambient types should update active state', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Select rain
      await settings.setAmbientType('rain');
      await expect(page.locator('[data-type="rain"]')).toHaveAttribute('data-active', 'true');
      await expect(page.locator('[data-type="fireplace"]')).toHaveAttribute('data-active', 'false');

      // Switch to fireplace
      await settings.setAmbientType('fireplace');
      await expect(page.locator('[data-type="rain"]')).toHaveAttribute('data-active', 'false');
      await expect(page.locator('[data-type="fireplace"]')).toHaveAttribute('data-active', 'true');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Settings Persistence', () => {
    test('all settings should persist together', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Set all settings
      await settings.setFont('lora');
      await settings.setFontSize(20);
      await settings.setTheme('dark');
      await settings.disableSound();
      await settings.setAmbientType('rain');

      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      // Verify all settings
      await settings.open();
      expect(await settings.getFont()).toBe('lora');
      expect(await settings.getFontSize()).toBe(20);
      expect(await settings.getTheme()).toBe('dark');
      expect(await settings.isSoundEnabled()).toBe(false);
      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('should handle corrupted localStorage gracefully', async ({ bookPage, page }) => {
      // Set corrupted data
      await page.addInitScript(() => {
        localStorage.setItem('flipbook_settings', 'invalid{json');
      });

      await bookPage.goto();

      // Should still load with defaults
      await expect(bookPage.book).toBeVisible();
    });

    test('should use stored settings on load', async ({ bookPage, settings, page }) => {
      await setStoredSettings(page, {
        font: 'literata',
        fontSize: 16,
        theme: 'bw',
        page: 0,
      });

      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getFont()).toBe('literata');
      expect(await settings.getFontSize()).toBe(16);
      expect(await settings.getTheme()).toBe('bw');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Debug Panel', () => {
    test('should toggle debug panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await settings.isDebugVisible()).toBe(false);

      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(true);

      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(false);
    });

    test('debug panel should show state info', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.toggleDebug();

      const debugInfo = page.locator('.debug-info');
      await expect(debugInfo).toBeVisible();
      await expect(debugInfo).toContainText(/state|page|cache/i);
    });
  });
});
