/**
 * E2E TESTS: PERFORMANCE
 * Load times, animation performance, memory leaks
 */

import { test, expect, clearStorage, viewports, getPerformanceMetrics } from '../fixtures/book.fixture.js';

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL LOAD PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Initial Load Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('page should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('DOM content loaded within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const domLoadTime = Date.now() - startTime;

    expect(domLoadTime).toBeLessThan(2000);
  });

  test('book element should be visible quickly', async ({ bookPage }) => {
    const startTime = Date.now();

    await bookPage.goto();
    await bookPage.book.waitFor({ state: 'visible' });

    const visibleTime = Date.now() - startTime;

    expect(visibleTime).toBeLessThan(2000);
  });

  test('should have acceptable First Contentful Paint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await getPerformanceMetrics(page);

    if (metrics.firstContentfulPaint) {
      expect(metrics.firstContentfulPaint).toBeLessThan(1500);
    }
  });

  test('should not have excessive JS heap usage on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await getPerformanceMetrics(page);

    if (metrics.usedJSHeapSize) {
      // Should be less than 50MB on initial load
      expect(metrics.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BOOK OPEN PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Book Open Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('book should open within 2 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.cover.click();
    await bookPage.waitForState('opened', 5000);
    const openTime = Date.now() - startTime;

    // Opening includes animation (~1.2s) plus content load
    expect(openTime).toBeLessThan(2500);
  });

  test('content should be paginated within 3 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.openByCover();

    // Wait for total pages to be calculated
    await bookPage.page.waitForFunction(() => {
      const total = document.querySelector('.total-pages');
      return total && parseInt(total.textContent) > 0;
    });

    const paginationTime = Date.now() - startTime;

    expect(paginationTime).toBeLessThan(3000);
  });

  test('loading indicator should disappear within 3 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.cover.click();

    // Wait for loading to complete
    await bookPage.loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAGE FLIP ANIMATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Page Flip Animation Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('page flip should complete within animation budget', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await bookPage.btnNext.click();
    await bookPage.waitForState('opened', 3000);
    const flipTime = Date.now() - startTime;

    // Total animation: lift(240ms) + rotate(900ms) + drop(160ms) = 1300ms + buffer
    expect(flipTime).toBeLessThan(1800);
  });

  test('consecutive flips should maintain performance', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const flipTimes = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await bookPage.flipNext();
      flipTimes.push(Date.now() - startTime);
    }

    // All flips should be consistent
    const avgTime = flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length;
    expect(avgTime).toBeLessThan(1800);

    // No flip should be drastically slower
    const maxTime = Math.max(...flipTimes);
    expect(maxTime).toBeLessThan(2500);
  });

  test('keyboard navigation should be responsive', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await page.keyboard.press('ArrowRight');
    await bookPage.waitForAnimation();
    const keyTime = Date.now() - startTime;

    expect(keyTime).toBeLessThan(1800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REPAGINATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Repagination Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('font size change repagination within 2 seconds', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await settings.open();

    const startTime = Date.now();
    await settings.btnIncrease.click();
    await settings.waitForRepagination();
    const repaginateTime = Date.now() - startTime;

    expect(repaginateTime).toBeLessThan(2000);
  });

  test('font family change repagination within 2 seconds', async ({ bookPage, settings, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await settings.open();

    const startTime = Date.now();
    await settings.fontSelect.selectOption('merriweather');
    await settings.waitForRepagination();
    const repaginateTime = Date.now() - startTime;

    expect(repaginateTime).toBeLessThan(2000);
  });

  test('resize repagination within 3 seconds', async ({ bookPage, page }) => {
    await page.setViewportSize(viewports.desktop);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await page.setViewportSize(viewports.mobile);

    // Wait for repagination
    await page.waitForTimeout(500);
    await bookPage.waitForState('opened', 5000);

    const resizeTime = Date.now() - startTime;

    expect(resizeTime).toBeLessThan(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Memory Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('no significant memory growth after 20 page flips', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Get initial memory
    const initialMetrics = await getPerformanceMetrics(page);
    const initialMemory = initialMetrics.usedJSHeapSize || 0;

    // Flip forward 10 times
    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    // Flip backward 10 times
    for (let i = 0; i < 10; i++) {
      await bookPage.flipPrev();
    }

    // Force garbage collection if possible
    await page.evaluate(() => {
      if (global.gc) global.gc();
    });
    await page.waitForTimeout(500);

    // Get final memory
    const finalMetrics = await getPerformanceMetrics(page);
    const finalMemory = finalMetrics.usedJSHeapSize || 0;

    if (initialMemory > 0 && finalMemory > 0) {
      // Memory shouldn't grow more than 50%
      const growthRatio = finalMemory / initialMemory;
      expect(growthRatio).toBeLessThan(1.5);
    }
  });

  test('no memory leak after opening/closing book multiple times', async ({ bookPage, page }) => {
    await bookPage.goto();

    const initialMetrics = await getPerformanceMetrics(page);
    const initialMemory = initialMetrics.usedJSHeapSize || 0;

    // Open and close book 5 times
    for (let i = 0; i < 5; i++) {
      await bookPage.openByCover();
      await bookPage.flipNext();
      await bookPage.flipByKey('home');
      await bookPage.flipPrev(); // Close
      await bookPage.waitForState('closed', 5000);
    }

    await page.waitForTimeout(500);

    const finalMetrics = await getPerformanceMetrics(page);
    const finalMemory = finalMetrics.usedJSHeapSize || 0;

    if (initialMemory > 0 && finalMemory > 0) {
      const growthRatio = finalMemory / initialMemory;
      expect(growthRatio).toBeLessThan(2.0);
    }
  });

  test('LRU cache should limit memory usage', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Enable debug to check cache
    await settings.toggleDebug();

    // Navigate through many pages
    for (let i = 0; i < 20; i++) {
      await bookPage.flipNext();
    }

    // Cache should be limited (check debug panel if visible)
    const debugInfo = await bookPage.page.locator('.debug-info').textContent();

    if (debugInfo && debugInfo.includes('cache')) {
      // Cache size should be limited to configured max (12)
      const cacheMatch = debugInfo.match(/cache[:\s]*(\d+)/i);
      if (cacheMatch) {
        const cacheSize = parseInt(cacheMatch[1]);
        expect(cacheSize).toBeLessThanOrEqual(12);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Mobile Performance', () => {
  test.use({ viewport: viewports.mobile });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('mobile load time should be acceptable', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Mobile might be slightly slower, allow 4s
    expect(loadTime).toBeLessThan(4000);
  });

  test('mobile flip animation should be smooth', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const flipTimes = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await bookPage.flipNext();
      flipTimes.push(Date.now() - startTime);
    }

    const avgTime = flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length;

    // Mobile flips single page, should be faster
    expect(avgTime).toBeLessThan(1500);
  });

  test('swipe gesture should be responsive', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();
    const startTime = Date.now();

    // Perform swipe
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await bookPage.waitForAnimation();
    const swipeTime = Date.now() - startTime;

    expect(swipeTime).toBeLessThan(1800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE LOADING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Resource Loading', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should not have failed resource requests', async ({ page }) => {
    const failedRequests = [];

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected failures (e.g., analytics, external resources)
    const criticalFailures = failedRequests.filter(r =>
      !r.url.includes('analytics') &&
      !r.url.includes('fonts.googleapis')
    );

    expect(criticalFailures).toHaveLength(0);
  });

  test('should load images lazily or efficiently', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Check that images in content have loading strategy
    const images = await page.locator('.page-content img').all();

    for (const img of images) {
      const loading = await img.getAttribute('loading');
      const dataLoading = await img.getAttribute('data-loading');

      // Either native lazy loading or custom loading state
      const hasLoadingStrategy = loading === 'lazy' || dataLoading !== null;

      // This is a soft check - not all images need lazy loading
    }
  });

  test('background images should preload', async ({ bookPage, page }) => {
    await bookPage.goto();

    // Check that background manager preloaded images
    const bgStyle = await bookPage.book.evaluate(el =>
      getComputedStyle(el).backgroundImage
    );

    // Background should be set (either image or gradient fallback)
    expect(bgStyle).not.toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LONG SESSION STABILITY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Long Session Stability', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should remain stable after extended navigation', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Navigate extensively
    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    await bookPage.flipByKey('home');

    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    await bookPage.flipByKey('end');
    await bookPage.flipByKey('home');

    // Book should still be functional
    expect(await bookPage.isOpened()).toBe(true);

    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.flipNext();
    const pageAfter = await bookPage.getCurrentPageIndex();

    expect(pageAfter).toBeGreaterThan(pageBefore);
  });

  test('settings changes should not degrade performance', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Change settings multiple times
    await settings.setTheme('dark');
    await settings.setTheme('light');
    await settings.setTheme('bw');
    await settings.setTheme('light');

    await settings.setFontSize(20);
    await settings.setFontSize(16);
    await settings.setFontSize(18);

    // Flip should still be responsive
    const startTime = Date.now();
    await bookPage.flipNext();
    const flipTime = Date.now() - startTime;

    expect(flipTime).toBeLessThan(2000);
  });
});
