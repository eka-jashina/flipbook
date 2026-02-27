/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 *
 * Фаза 3: поток аутентификации
 * 1. GET /api/health → проверка доступности сервера
 * 2. GET /api/auth/me → если 401 → модалка логина/регистрации
 * 3. После авторизации → проверка миграции localStorage
 * 4. GET /api/books → книжная полка
 * 5. Выбор книги → loadConfigFromAPI() → ридер
 *
 * Fallback: если сервер недоступен — работа через localStorage (как раньше).
 */

import { BookController } from './core/BookController.js';
import { BookshelfScreen, loadBooksFromAPI, getBookshelfData, clearActiveBook } from './core/BookshelfScreen.js';
import { CONFIG, enrichConfigFromIDB, loadConfigFromAPI, setConfig } from './config.js';
import { ApiClient } from './utils/ApiClient.js';
import { AuthModal } from './core/AuthModal.js';
import { MigrationHelper } from './core/MigrationHelper.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';
import { installPrompt } from './utils/InstallPrompt.js';
import { photoLightbox } from './utils/PhotoLightbox.js';

// Глобальная ссылка на контроллер (для отладки)
let app = null;
let bookshelf = null;
let authModal = null;
let apiClient = null;

// Регистрация Service Worker для PWA
const updateSW = registerSW({
  onNeedRefresh() {
    const shouldUpdate = confirm('Доступна новая версия приложения. Обновить?');
    if (shouldUpdate) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Flipbook готов к работе offline');
  },
  onRegisteredSW(swUrl, _registration) {
    console.log('Service Worker зарегистрирован:', swUrl);
  },
  onRegisterError(error) {
    console.error('Ошибка регистрации Service Worker:', error);
  },
});

/**
 * Настройка кнопки установки PWA в настройках
 */
function setupInstallButton() {
  const installSection = document.getElementById('install-section');
  const installBtn = document.getElementById('install-btn');

  if (!installSection || !installBtn) return;

  const updateVisibility = () => {
    installSection.hidden = !installPrompt.canInstall;
  };

  installPrompt.onStateChange((event) => {
    if (event === 'available' || event === 'installed' || event === 'dismissed') {
      updateVisibility();
    }
  });

  installBtn.addEventListener('click', async () => {
    installPrompt.resetDismissed();
    await installPrompt.install();
    updateVisibility();
  });

  updateVisibility();
}

/**
 * Настройка кнопки "Назад к полке"
 */
function setupBackToShelfButton() {
  const btn = document.getElementById('backToShelfBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Очищаем и localStorage, и sessionStorage
    clearActiveBook();
    sessionStorage.removeItem('flipbook-active-book-id');
    location.reload();
  });
}

/**
 * Показать книжный шкаф
 */
function showBookshelf(books) {
  const container = document.getElementById('bookshelf-screen');
  if (!container) return;

  document.body.dataset.hasBookshelf = 'true';

  bookshelf = new BookshelfScreen({
    container,
    books,
    apiClient,
    onBookSelect: (bookId) => {
      // Запоминаем bookId в sessionStorage и перезагружаем
      sessionStorage.setItem('flipbook-active-book-id', bookId);
      sessionStorage.setItem('flipbook-reading-session', '1');

      // Для localStorage fallback — также сохраняем activeBookId
      if (!apiClient) {
        try {
          const raw = localStorage.getItem('flipbook-admin-config');
          const config = raw ? JSON.parse(raw) : { books: [] };
          config.activeBookId = bookId;
          localStorage.setItem('flipbook-admin-config', JSON.stringify(config));
        } catch { /* ignore */ }
      }

      location.reload();
    },
  });

  bookshelf.render();
  bookshelf.show();
}

/**
 * Инициализация ридера через API (Фаза 3)
 */
async function initReaderFromAPI(bookId) {
  const config = await loadConfigFromAPI(apiClient, bookId);

  // Загрузить прогресс чтения с сервера
  const progress = await apiClient.getProgress(bookId).catch(() => null);

  app = new BookController(config, { apiClient, bookId, serverProgress: progress });
  await app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl) {
    photoLightbox.attach(bookEl);
  }

  setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = app;
  }
}

/**
 * Инициализация ридера через localStorage (fallback)
 */
async function initReaderFallback() {
  const enriched = await enrichConfigFromIDB(CONFIG);
  if (enriched !== CONFIG) setConfig(enriched);

  app = new BookController();
  await app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl) {
    photoLightbox.attach(bookEl);
  }

  setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = app;
  }
}

/**
 * Инициализация с авторизацией (Фаза 3)
 * @returns {Promise<Object>} user
 */
async function initWithAuth() {
  apiClient = new ApiClient({
    onUnauthorized: () => {
      if (authModal) authModal.show();
    },
  });

  // Проверяем авторизацию
  const user = await apiClient.getMe();

  if (!user) {
    // Не авторизован — показываем модалку
    return new Promise((resolve) => {
      authModal = new AuthModal({
        apiClient,
        onAuth: async (loggedInUser) => {
          const migration = new MigrationHelper(apiClient);
          await migration.checkAndMigrate();
          resolve(loggedInUser);
        },
      });
      authModal.show();
    });
  }

  // Авторизован — проверить миграцию при первом логине
  const migration = new MigrationHelper(apiClient);
  await migration.checkAndMigrate();
  return user;
}

/**
 * Инициализация приложения
 */
async function init() {
  try {
    // Проверяем, доступен ли сервер
    let useAPI = false;
    try {
      const resp = await fetch('/api/health', { method: 'GET' });
      useAPI = resp.ok;
    } catch {
      // Сервер недоступен — работаем в localStorage-режиме
    }

    if (useAPI) {
      // ═══════════════════════════════════════
      // Фаза 3: работа через API
      // ═══════════════════════════════════════
      await initWithAuth();

      // Проверяем, есть ли сохранённый bookId из предыдущего выбора
      const savedBookId = sessionStorage.getItem('flipbook-active-book-id');
      const isReadingSession = !!sessionStorage.getItem('flipbook-reading-session');

      if (savedBookId && isReadingSession) {
        // Показываем ридер для выбранной книги
        document.body.dataset.screen = 'reader';
        document.body.dataset.hasBookshelf = 'true';
        setupBackToShelfButton();

        await initReaderFromAPI(savedBookId);
      } else {
        // Показываем книжную полку
        const books = await loadBooksFromAPI(apiClient);
        showBookshelf(books);
      }
    } else {
      // ═══════════════════════════════════════
      // Fallback: localStorage-режим
      // ═══════════════════════════════════════
      const { shouldShow, books } = getBookshelfData();

      if (shouldShow) {
        showBookshelf(books);
        return;
      }

      // Всегда показываем кнопку «К полке»
      document.body.dataset.screen = 'reader';
      document.body.dataset.hasBookshelf = 'true';
      setupBackToShelfButton();

      await initReaderFallback();
    }
  } catch (error) {
    console.error('Failed to initialize Book Reader:', error);
  }
}

/**
 * Очистка при выгрузке страницы
 */
function cleanup() {
  if (authModal) {
    authModal.destroy();
    authModal = null;
  }
  if (bookshelf) {
    bookshelf.destroy();
    bookshelf = null;
  }
  if (app) {
    app.destroy();
    app = null;
  }
  offlineIndicator.destroy();
  installPrompt.destroy();
  photoLightbox.destroy();
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Очистка при закрытии/переходе
window.addEventListener('beforeunload', cleanup);

// Реинициализация при восстановлении из bfcache
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    cleanup();
    init();
  }
});
