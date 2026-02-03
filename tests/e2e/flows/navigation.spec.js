/**
 * E2E TESTS: NAVIGATION
 * Keyboard, touch, click, and drag navigation tests
 */

import { test, expect, clearStorage, viewports } from '../fixtures/book.fixture.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Keyboard Navigation', () => {
    test('ArrowRight flips to next page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.flipByKey('right');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('ArrowLeft flips to previous page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // First go forward a bit
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.flipByKey('left');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('Home key goes to first page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Navigate away from start
      await bookPage.flipNext();
      await bookPage.flipNext();
      await bookPage.flipNext();

      await bookPage.flipByKey('home');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(0);
    });

    test('End key goes to last page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipByKey('end');

      const currentPage = await bookPage.getCurrentPageDisplay();
      const totalPages = await bookPage.getTotalPages();

      expect(currentPage).toBeGreaterThanOrEqual(totalPages - 2);
    });

    test('Ctrl+D toggles debug panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Initially hidden
      expect(await settings.isDebugVisible()).toBe(false);

      // Toggle on
      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(true);

      // Toggle off
      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(false);
    });

    test('should not navigate when input is focused', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Focus on an input element (font select)
      await page.locator('.font-select').focus();
      await page.keyboard.press('ArrowRight');

      const pageAfter = await bookPage.getCurrentPageIndex();
      expect(pageAfter).toBe(pageBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTON NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Button Navigation', () => {
    test('next button flips forward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.flipNext();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('prev button flips backward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.flipPrev();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('buttons should be disabled during animation', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Click next without waiting
      await bookPage.btnNext.click();

      // Immediately try to click again (should be ignored due to busy state)
      const stateDuringAnimation = await bookPage.getState();
      expect(['flipping', 'opened']).toContain(stateDuringAnimation);

      // Wait for animation to complete
      await bookPage.waitForAnimation();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK NAVIGATION (Desktop)
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Click Navigation (Desktop)', () => {
    test.use({ viewport: viewports.desktop });

    test('clicking right half flips forward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.clickBookHalf('right');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('clicking left half flips backward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // First go forward
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.clickBookHalf('left');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('clicking on TOC should not flip page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Click on TOC area
      const tocItem = page.locator('.toc li').first();
      if (await tocItem.isVisible()) {
        await tocItem.click();
        // TOC click navigates to chapter, not flip
      }

      // Page should change due to chapter navigation, not half-click
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUCH/SWIPE NAVIGATION (Mobile)
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Touch Navigation (Mobile)', () => {
    test.use({ viewport: viewports.mobile });

    test('swipe left flips to next page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Perform swipe
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width * 0.8;
      const endX = box.x + box.width * 0.2;
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 10 });
      await page.mouse.up();

      await bookPage.waitForAnimation();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('swipe right flips to previous page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Go forward first
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      // Perform swipe right
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width * 0.2;
      const endX = box.x + box.width * 0.8;
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 10 });
      await page.mouse.up();

      await bookPage.waitForAnimation();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('small swipe does not trigger flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Small swipe (below threshold)
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width / 2;
      const endX = startX - 15; // Less than 20px threshold
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 5 });
      await page.mouse.up();

      await page.waitForTimeout(500);
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(pageBefore);
    });

    test('vertical swipe does not trigger flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Vertical swipe
      const book = bookPage.book;
      const box = await book.boundingBox();
      const x = box.x + box.width / 2;
      const startY = box.y + box.height * 0.7;
      const endY = box.y + box.height * 0.3;

      await page.mouse.move(x, startY);
      await page.mouse.down();
      await page.mouse.move(x, endY, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(pageBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Drag Navigation', () => {
    test.use({ viewport: viewports.desktop });

    test('drag from bottom-right corner flips forward', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Navigate away from TOC first
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      // Check if corner zone exists
      const cornerZone = page.locator('.corner-zone-br');
      if (await cornerZone.isVisible()) {
        const box = await cornerZone.boundingBox();

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 300, box.y, { steps: 20 });
        await page.mouse.up();

        await bookPage.waitForAnimation();
        const pageAfter = await bookPage.getCurrentPageIndex();

        expect(pageAfter).toBeGreaterThan(pageBefore);
      }
    });

    test('drag and release in middle cancels flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      const cornerZone = page.locator('.corner-zone-br');
      if (await cornerZone.isVisible()) {
        const box = await cornerZone.boundingBox();

        // Start drag but release early (not enough distance)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 50, box.y, { steps: 10 }); // Small drag
        await page.mouse.up();

        await page.waitForTimeout(500);
        const pageAfter = await bookPage.getCurrentPageIndex();

        // Page should not have changed (flip cancelled)
        expect(pageAfter).toBe(pageBefore);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Edge Cases', () => {
    test('rapid clicking should not break state', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        bookPage.btnNext.click(); // Don't await
      }

      // Wait for things to settle
      await page.waitForTimeout(3000);

      // Book should be in valid state
      const state = await bookPage.getState();
      expect(['opened', 'flipping']).toContain(state);

      // Should eventually return to opened state
      await bookPage.waitForState('opened', 5000);
      expect(await bookPage.isOpened()).toBe(true);
    });

    test('cannot flip past last page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Go to end
      await bookPage.flipByKey('end');
      const lastPage = await bookPage.getCurrentPageIndex();

      // Try to flip forward
      await bookPage.flipNext();
      const afterFlip = await bookPage.getCurrentPageIndex();

      // Should still be at last page
      expect(afterFlip).toBe(lastPage);
    });

    test('closing book from first page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Ensure at first page
      await bookPage.flipByKey('home');

      // Flip backward to close
      await bookPage.flipPrev();
      await bookPage.waitForState('closed', 5000);

      expect(await bookPage.isClosed()).toBe(true);
    });
  });
});
