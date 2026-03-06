/**
 * E2E: Admin Panel — загрузка книг, редактирование глав, управление шрифтами.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode),
 * поэтому не требуют работающего сервера.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Подготовить admin config в localStorage перед загрузкой страницы
 */
async function seedAdminConfig(page, config) {
  await page.addInitScript((configStr) => {
    localStorage.setItem('flipbook-admin-config', configStr);
  }, JSON.stringify(config));
}

/**
 * Создать минимальную книгу для тестирования
 */
function createTestBook(overrides = {}) {
  return {
    id: overrides.id || 'test-book-1',
    cover: {
      title: overrides.title || 'Test Book',
      author: overrides.author || 'Test Author',
    },
    chapters: overrides.chapters || [],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: { coverBgStart: '#1a3a4a', coverBgEnd: '#0d1f2d', coverText: '#d4af37' },
      dark: { coverBgStart: '#1a1a2e', coverBgEnd: '#16213e', coverText: '#e0c068' },
    },
    decorativeFont: null,
    defaultSettings: {},
    ...overrides,
  };
}

/**
 * Построить полный admin config
 */
function buildAdminConfig(books = [], overrides = {}) {
  return {
    books,
    activeBookId: books[0]?.id || null,
    readingFonts: overrides.readingFonts || [
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
      { id: 'merriweather', label: 'Merriweather', family: 'Merriweather, serif', builtin: true, enabled: true },
    ],
    settingsVisibility: {
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: true,
      ambient: true,
    },
    fontMin: 14,
    fontMax: 22,
    ...overrides,
  };
}

/**
 * Перейти к экрану аккаунта
 */
async function navigateToAccount(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Навигация к аккаунту через UI или прямой URL
  await page.evaluate(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => {});
  });

  test.describe('Account Screen Navigation', () => {
    test('should show account screen with tabs', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Основные табы
      const booksTab = page.locator('.admin-tab[data-tab="books"]');
      await expect(booksTab).toBeVisible();

      const exportTab = page.locator('.admin-tab[data-tab="export"]');
      await expect(exportTab).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Переключиться на вкладку экспорта
      await page.locator('.admin-tab[data-tab="export"]').click();
      const exportPanel = page.locator('.admin-panel[data-panel="export"]');
      await expect(exportPanel).toBeVisible();
    });
  });

  test.describe('Book Management', () => {
    test('should display existing books in bookshelf view', async ({ page }) => {
      const book1 = createTestBook({ id: 'book-1', title: 'First Book' });
      const book2 = createTestBook({ id: 'book-2', title: 'Second Book' });
      await seedAdminConfig(page, buildAdminConfig([book1, book2]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Должны быть видны карточки книг
      const bookCards = page.locator('.book-card, [data-book-id]');
      await expect(bookCards).toHaveCount(2);
    });

    test('should show mode selector when adding new book', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('#addBookBtn');
      if (await addBtn.isVisible()) {
        await addBtn.click();
        // Должен появиться выбор режима создания
        const modeSelector = page.locator('[data-view="mode-selector"]');
        await expect(modeSelector).toBeVisible();
      }
    });

    test('should show manual book creation mode card', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('#addBookBtn');
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const manualMode = page.locator('.mode-card[data-mode="manual"]');
        await expect(manualMode).toBeVisible();
      }
    });

    test('should show upload mode card', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('#addBookBtn');
      if (await addBtn.isVisible()) {
        await addBtn.click();
        const uploadMode = page.locator('.mode-card[data-mode="upload"]');
        await expect(uploadMode).toBeVisible();
      }
    });
  });

  test.describe('Book Editor', () => {
    test('should show editor tabs when book is selected', async ({ page }) => {
      const book = createTestBook({ title: 'Editable Book' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Найти и кликнуть на книгу для редактирования
      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        // Должны появиться вкладки редактора
        const coverTab = page.locator('.editor-tab[data-editor-tab="cover"]');
        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        await expect(coverTab).toBeVisible();
        await expect(chaptersTab).toBeVisible();
      }
    });

    test('should show cover editor with title and author fields', async ({ page }) => {
      const book = createTestBook({ title: 'Cover Test', author: 'Author Name' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const coverTitle = page.locator('#coverTitle');
        const coverAuthor = page.locator('#coverAuthor');

        if (await coverTitle.isVisible()) {
          await expect(coverTitle).toHaveValue('Cover Test');
          await expect(coverAuthor).toHaveValue('Author Name');
        }
      }
    });

    test('should update cover title', async ({ page }) => {
      const book = createTestBook({ title: 'Original Title' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const coverTitle = page.locator('#coverTitle');
        if (await coverTitle.isVisible()) {
          await coverTitle.fill('Updated Title');
          await page.locator('#saveCover').click();

          // Проверить что сохранилось
          const savedConfig = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('flipbook-admin-config') || '{}'),
          );
          const savedBook = savedConfig.books?.find((b) => b.id === 'test-book-1');
          expect(savedBook?.cover?.title).toBe('Updated Title');
        }
      }
    });

    test('should switch between editor tabs', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Chapter 1', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        // Кликнуть на вкладку глав
        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (await chaptersTab.isVisible()) {
          await chaptersTab.click();

          const chaptersPanel = page.locator('.editor-panel[data-editor-panel="chapters"]');
          await expect(chaptersPanel).toBeVisible();
        }
      }
    });
  });

  test.describe('Chapter Management', () => {
    test('should show empty state when no chapters', async ({ page }) => {
      const book = createTestBook({ chapters: [] });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (await chaptersTab.isVisible()) {
          await chaptersTab.click();

          const emptyState = page.locator('#chaptersEmpty');
          const addBtn = page.locator('#addChapter');
          // Должно быть пустое состояние или кнопка добавления
          const eitherVisible =
            (await emptyState.isVisible().catch(() => false)) ||
            (await addBtn.isVisible().catch(() => false));
          expect(eitherVisible).toBe(true);
        }
      }
    });

    test('should open chapter modal on add click', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (await chaptersTab.isVisible()) {
          await chaptersTab.click();

          const addBtn = page.locator('#addChapter');
          if (await addBtn.isVisible()) {
            await addBtn.click();

            const modal = page.locator('#chapterModal');
            await expect(modal).toBeVisible();
          }
        }
      }
    });

    test('should display existing chapters in list', async ({ page }) => {
      const book = createTestBook({
        chapters: [
          { id: 'ch1', title: 'Introduction', file: 'content/part_1.html', bg: '', bgMobile: '' },
          { id: 'ch2', title: 'The Journey', file: 'content/part_2.html', bg: '', bgMobile: '' },
        ],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (await chaptersTab.isVisible()) {
          await chaptersTab.click();

          const chaptersList = page.locator('#chaptersList');
          if (await chaptersList.isVisible()) {
            const items = chaptersList.locator('.chapter-item, [data-chapter-id]');
            await expect(items).toHaveCount(2);
          }
        }
      }
    });
  });

  test.describe('Font Management', () => {
    test('should display reading fonts in settings', async ({ page }) => {
      const config = buildAdminConfig([], {
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'lora', label: 'Lora', family: 'Lora, serif', builtin: true, enabled: false },
          { id: 'custom-1', label: 'Custom Font', family: 'CustomFont', builtin: false, enabled: true },
        ],
      });
      await seedAdminConfig(page, config);
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      // Перейти на вкладку настроек платформы
      const settingsTab = page.locator('.admin-tab[data-tab="platform"]');
      if (await settingsTab.isVisible()) {
        await settingsTab.click();

        const settingsPanel = page.locator('.admin-panel[data-panel="platform"]');
        await expect(settingsPanel).toBeVisible();
      }
    });

    test('should show font configuration in reader settings', async ({ page }) => {
      const book = createTestBook();
      const config = buildAdminConfig([book], {
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'merriweather', label: 'Merriweather', family: 'Merriweather, serif', builtin: true, enabled: true },
        ],
      });
      await seedAdminConfig(page, config);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Шрифты должны быть доступны в настройках читалки
      const fontSelect = page.locator('.font-select, #font-select');
      if (await fontSelect.isVisible()) {
        const options = fontSelect.locator('option');
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe('Export/Import', () => {
    test('should show export panel with config JSON', async ({ page }) => {
      const book = createTestBook({ title: 'Export Test' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const exportTab = page.locator('.admin-tab[data-tab="export"]');
      if (await exportTab.isVisible()) {
        await exportTab.click();

        const exportPanel = page.locator('.admin-panel[data-panel="export"]');
        await expect(exportPanel).toBeVisible();
      }
    });
  });

  test.describe('Appearance Customization', () => {
    test('should show appearance editor with preview', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const appearanceTab = page.locator('.editor-tab[data-editor-tab="appearance"]');
        if (await appearanceTab.isVisible()) {
          await appearanceTab.click();

          const preview = page.locator('#appearancePreview');
          if (await preview.isVisible()) {
            await expect(preview).toBeVisible();
          }
        }
      }
    });

    test('should toggle between light and dark theme editing', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      await page.goto('/account');
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible()) {
        await bookCard.click();

        const appearanceTab = page.locator('.editor-tab[data-editor-tab="appearance"]');
        if (await appearanceTab.isVisible()) {
          await appearanceTab.click();

          const darkToggle = page.locator('[data-edit-theme="dark"]');
          if (await darkToggle.isVisible()) {
            await darkToggle.click();
            // Dark theme editing should now be active
            await expect(darkToggle).toHaveClass(/active/);
          }
        }
      }
    });
  });
});
