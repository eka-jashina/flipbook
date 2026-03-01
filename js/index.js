/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 *
 * Роутинг (SPA, History API):
 *   /              → лендинг (гости) | книжная полка (авторизованные) | fallback (localStorage)
 *   /book/:bookId  → ридер
 *
 * Поток:
 * 1. GET /api/health → проверка доступности сервера
 * 2. GET /api/auth/me → определяем, гость или авторизован
 * 3. Роутер резолвит URL:
 *    - гость на / → LandingScreen (CTA → AuthModal)
 *    - авторизованный на / → BookshelfScreen
 *    - /book/:id → ридер (авторизованный) или redirect на / (гость)
 *
 * Fallback: если сервер недоступен — работа через localStorage.
 */

import { BookController } from './core/BookController.js';
import { BookshelfScreen, loadBooksFromAPI, getBookshelfData, clearActiveBook } from './core/BookshelfScreen.js';
import { LandingScreen } from './core/LandingScreen.js';
import { CONFIG, enrichConfigFromIDB, loadConfigFromAPI, setConfig } from './config.js';
import { ApiClient } from './utils/ApiClient.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { AuthModal } from './core/AuthModal.js';
import { MigrationHelper } from './core/MigrationHelper.js';
import { Router } from './utils/Router.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';
import { installPrompt } from './utils/InstallPrompt.js';
import { photoLightbox } from './utils/PhotoLightbox.js';

// Catch unhandled promise rejections globally so they don't vanish silently
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Глобальное состояние
let app = null;
let bookshelf = null;
let landing = null;
let authModal = null;
let apiClient = null;
let router = null;
let currentUser = null;
let useAPI = false;

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

// ═══════════════════════════════════════════════════
// Утилиты экранов
// ═══════════════════════════════════════════════════

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
    clearActiveBook();
    if (router) {
      router.navigate('/');
    } else {
      location.reload();
    }
  });
}

/**
 * Очистить ридер перед показом другого экрана.
 */
function cleanupReader() {
  if (app) {
    app.destroy();
    app = null;
  }
  photoLightbox.destroy();
}

/**
 * Очистить полку перед показом другого экрана.
 */
function cleanupBookshelf() {
  if (bookshelf) {
    bookshelf.destroy();
    bookshelf = null;
  }
}

/**
 * Очистить лендинг перед показом другого экрана.
 */
function cleanupLanding() {
  if (landing) {
    landing.destroy();
    landing = null;
  }
}

// ═══════════════════════════════════════════════════
// Обработчики маршрутов
// ═══════════════════════════════════════════════════

/**
 * Маршрут: / → Лендинг (гости) или Книжная полка (авторизованные)
 */
async function handleHome() {
  cleanupReader();
  cleanupLanding();
  cleanupBookshelf();

  if (useAPI && !currentUser) {
    // Гость → лендинг
    showLanding();
  } else if (useAPI) {
    // Авторизован → книжная полка
    const books = await loadBooksFromAPI(apiClient);
    showBookshelf(books);
  } else {
    // localStorage fallback — URL определяет состояние, на / всегда показываем полку
    const { books } = getBookshelfData();
    showBookshelf(books);
  }
}

/**
 * Маршрут: /book/:bookId → Показать ридер
 */
async function handleReader({ bookId }) {
  // Гость не может открыть ридер через API (пока нет публичного чтения — Phase 6)
  if (useAPI && !currentUser) {
    router.navigate('/', { replace: true });
    return;
  }

  cleanupLanding();
  cleanupBookshelf();
  cleanupReader();

  document.body.dataset.screen = 'reader';
  document.body.dataset.hasBookshelf = 'true';
  setupBackToShelfButton();

  if (useAPI) {
    await initReaderFromAPI(bookId);
  } else {
    // Для localStorage fallback — устанавливаем activeBookId
    try {
      const raw = localStorage.getItem('flipbook-admin-config');
      const config = raw ? JSON.parse(raw) : { books: [] };
      config.activeBookId = bookId;
      localStorage.setItem('flipbook-admin-config', JSON.stringify(config));
    } catch { /* ignore */ }

    await initReaderFallback();
  }
}

/**
 * Показать лендинг для гостей.
 */
function showLanding() {
  const container = document.getElementById('landing-screen');
  if (!container) return;

  landing = new LandingScreen({
    container,
    onAuth: () => {
      // CTA нажата → показать модалку аутентификации
      if (!authModal) {
        authModal = new AuthModal({
          apiClient,
          onAuth: async (user) => {
            currentUser = user;
            const migration = new MigrationHelper(apiClient);
            await migration.checkAndMigrate();
            // Перенаправляем на главную — теперь покажется полка
            router.navigate('/', { replace: true });
          },
        });
      }
      authModal.show();
    },
  });

  landing.show();
}

/**
 * Показать книжный шкаф.
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
      if (router) {
        router.navigate(`/book/${bookId}`);
      } else {
        location.reload();
      }
    },
  });

  bookshelf.render();
  bookshelf.show();
}

// ═══════════════════════════════════════════════════
// Инициализация ридера
// ═══════════════════════════════════════════════════

/**
 * Инициализация ридера через API
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

// ═══════════════════════════════════════════════════
// Авторизация
// ═══════════════════════════════════════════════════

/**
 * Проверить аутентификацию (неблокирующая).
 * Возвращает user или null (гость).
 * @returns {Promise<Object|null>}
 */
async function checkAuth() {
  apiClient = new ApiClient({
    onUnauthorized: () => {
      // Сессия истекла — сбрасываем пользователя и переходим на лендинг
      currentUser = null;
      if (router) router.navigate('/', { replace: true });
    },
  });

  const user = await apiClient.getMe();

  if (user) {
    // Авторизован — проверить миграцию при первом логине
    const migration = new MigrationHelper(apiClient);
    await migration.checkAndMigrate();
  }

  return user;
}

// ═══════════════════════════════════════════════════
// Инициализация приложения
// ═══════════════════════════════════════════════════

/**
 * Миграция: если URL — корень, но в sessionStorage есть bookId от старого флоу —
 * редиректим на /book/:id для совместимости.
 */
function migrateSessionStorageToRouter() {
  const savedBookId = sessionStorage.getItem('flipbook-active-book-id');
  const isReadingSession = !!sessionStorage.getItem('flipbook-reading-session');

  if (savedBookId && isReadingSession) {
    // Очищаем старые флаги
    sessionStorage.removeItem('flipbook-active-book-id');
    sessionStorage.removeItem('flipbook-reading-session');
    return savedBookId;
  }
  return null;
}

async function init() {
  try {
    // Проверяем, доступен ли сервер
    try {
      const resp = await fetch('/api/health', { method: 'GET' });
      useAPI = resp.ok;
    } catch {
      // Сервер недоступен — работаем в localStorage-режиме
    }

    if (useAPI) {
      currentUser = await checkAuth();
    }

    // Создаём роутер
    router = new Router([
      { name: 'home', path: '/', handler: handleHome },
      { name: 'reader', path: '/book/:bookId', handler: handleReader },
      // Будущие маршруты (Фазы 4-8):
      // { name: 'account', path: '/account', handler: handleAccount },
      // { name: 'embed', path: '/embed/:bookId', handler: handleEmbed },
      // { name: 'shelf', path: '/:username', handler: handlePublicShelf },
    ]);

    // Миграция: старый sessionStorage-флоу → URL-based навигация
    const migratedBookId = migrateSessionStorageToRouter();
    if (migratedBookId && location.pathname === `/${(import.meta.env.BASE_URL || '').replace(/^\/|\/$/g, '')}`) {
      // Подменяем URL перед стартом роутера
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      history.replaceState(null, '', `${base}/book/${migratedBookId}`);
    }

    // Запуск роутера — резолвит текущий URL
    await router.start();
  } catch (error) {
    console.error('Failed to initialize Book Reader:', error);
    ErrorHandler.handle(error, 'Не удалось запустить приложение');
  }
}

/**
 * Очистка при выгрузке страницы
 */
function cleanup() {
  if (router) {
    router.destroy();
    router = null;
  }
  if (authModal) {
    authModal.destroy();
    authModal = null;
  }
  cleanupLanding();
  cleanupBookshelf();
  cleanupReader();
  offlineIndicator.destroy();
  installPrompt.destroy();
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
