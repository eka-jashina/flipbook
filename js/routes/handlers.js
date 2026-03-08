/**
 * ROUTE HANDLERS
 *
 * Обработчики маршрутов SPA-роутера.
 * Выделены из index.js для уменьшения размера основного файла.
 *
 * Каждый обработчик отвечает за очистку предыдущего экрана
 * и инициализацию нового.
 */

import { BookshelfScreen, loadBooksFromAPI, getBookshelfData, clearActiveBook } from '../core/BookshelfScreen.js';
import { LandingScreen } from '../core/LandingScreen.js';
import { CONFIG, enrichConfigFromIDB, loadConfigFromAPI, loadPublicConfigFromAPI, setConfig } from '../config.js';
import { BookController } from '../core/BookController.js';
import { AuthModal } from '../core/AuthModal.js';
import { MigrationHelper } from '../core/MigrationHelper.js';
import { adminConfigStorage } from '../config/configHelpers.js';
import { installPrompt } from '../utils/InstallPrompt.js';
import { photoLightbox } from '../utils/PhotoLightbox.js';

/**
 * Контекст приложения, общий для всех обработчиков.
 * Инициализируется в index.js через initRouteHandlers().
 * @type {Object}
 */
let ctx = null;

/**
 * Инициализировать контекст для обработчиков маршрутов.
 * @param {Object} appContext
 * @param {Object} appContext.state - Мутируемое состояние (app, bookshelf, landing, accountScreen, authModal)
 * @param {import('../utils/ApiClient.js').ApiClient} appContext.apiClient
 * @param {import('../utils/Router.js').Router} appContext.router
 * @param {Object|null} appContext.currentUser
 * @param {boolean} appContext.useAPI
 * @param {(user: Object) => void} appContext.setCurrentUser
 */
export function initRouteHandlers(appContext) {
  ctx = appContext;
}

// ─── Утилиты экранов ────────────────────────────────────────────────────────

function cleanupReader() {
  if (ctx.state.app) {
    ctx.state.app.destroy();
    ctx.state.app = null;
  }
  photoLightbox.destroy();
  document.body.classList.remove('embed-mode');
  delete document.body.dataset.readerMode;
}

function cleanupBookshelf() {
  if (ctx.state.bookshelf) {
    ctx.state.bookshelf.destroy();
    ctx.state.bookshelf = null;
  }
  const el = document.getElementById('bookshelf-screen');
  if (el) el.hidden = true;
}

function cleanupLanding() {
  if (ctx.state.landing) {
    ctx.state.landing.destroy();
    ctx.state.landing = null;
  }
  const el = document.getElementById('landing-screen');
  if (el) el.hidden = true;
}

function hideAccount() {
  if (ctx.state.accountScreen) ctx.state.accountScreen.hide();
}

function setupInstallButton() {
  const installSection = document.getElementById('install-section');
  const installBtn = document.getElementById('install-btn');
  if (!installSection || !installBtn) return;

  const updateVisibility = () => { installSection.hidden = !installPrompt.canInstall; };
  installPrompt.onStateChange((event) => {
    if (event === 'available' || event === 'installed' || event === 'dismissed') updateVisibility();
  });
  installBtn.addEventListener('click', async () => {
    installPrompt.resetDismissed();
    await installPrompt.install();
    updateVisibility();
  });
  updateVisibility();
}

function setupBackToShelfButton() {
  const btn = document.getElementById('backToShelfBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearActiveBook();
    if (ctx.router) ctx.router.navigate('/');
    else location.reload();
  });
}

function showBookshelf(books, { mode = 'owner', profileUser } = {}) {
  const container = document.getElementById('bookshelf-screen');
  if (!container) return;
  document.body.dataset.hasBookshelf = 'true';

  ctx.state.bookshelf = new BookshelfScreen({
    container, books, apiClient: ctx.apiClient, mode, profileUser, router: ctx.router,
    onBookSelect: (bookId) => {
      if (ctx.router) ctx.router.navigate(`/book/${bookId}`);
      else location.reload();
    },
  });
  ctx.state.bookshelf.render();
  ctx.state.bookshelf.show();
}

function showLanding() {
  const container = document.getElementById('landing-screen');
  if (!container) return;

  ctx.state.landing = new LandingScreen({
    container,
    onAuth: () => {
      if (!ctx.state.authModal) {
        ctx.state.authModal = new AuthModal({
          apiClient: ctx.apiClient,
          onAuth: async (user) => {
            ctx.setCurrentUser(user);
            const migration = new MigrationHelper(ctx.apiClient);
            await migration.checkAndMigrate();
            const target = user.username ? `/${user.username}` : '/';
            ctx.router.navigate(target, { replace: true });
          },
        });
      }
      ctx.state.authModal.show();
    },
  });
  ctx.state.landing.show();
}

// ─── Обработчики маршрутов ──────────────────────────────────────────────────

/** Маршрут: / → Лендинг (гости) или redirect на /:username (авторизованные) */
export async function handleHome() {
  cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();

  if (ctx.useAPI && ctx.currentUser?.username) {
    ctx.router.navigate(`/${ctx.currentUser.username}`, { replace: true });
  } else if (ctx.useAPI && ctx.currentUser) {
    // Авторизован, но без username — загружаем книги через API
    const books = await loadBooksFromAPI(ctx.apiClient);
    showBookshelf(books);
  } else if (ctx.useAPI && !ctx.currentUser) {
    showLanding();
  } else {
    const { books } = getBookshelfData();
    showBookshelf(books);
  }
}

/** Маршрут: /:username → Публичная полка автора */
export async function handlePublicShelf({ username }) {
  cleanupReader(); cleanupLanding(); cleanupBookshelf(); hideAccount();
  const isOwner = ctx.currentUser?.username === username;

  if (isOwner) {
    const books = await loadBooksFromAPI(ctx.apiClient);
    showBookshelf(books, { mode: 'owner', profileUser: ctx.currentUser });
  } else {
    try {
      const data = await ctx.apiClient.getPublicShelf(username);
      showBookshelf(data.books || [], { mode: 'guest', profileUser: data.user || { username } });
    } catch (err) {
      if (err.status === 404) {
        ctx.router.navigate('/', { replace: true });
      } else {
        console.error('Ошибка загрузки публичной полки:', err);
        ctx.router.navigate('/', { replace: true });
      }
    }
  }
}

/** Маршрут: /book/:bookId → Показать ридер */
export async function handleReader({ bookId }) {
  cleanupLanding(); cleanupBookshelf(); cleanupReader(); hideAccount();
  document.body.dataset.screen = 'reader';
  document.body.dataset.hasBookshelf = 'true';
  setupBackToShelfButton();

  if (ctx.useAPI) {
    await initReaderWithMode(bookId, 'reader');
  } else {
    const config = adminConfigStorage.load();
    config.activeBookId = bookId;
    if (!config.books) config.books = [];
    adminConfigStorage.setFull(config);
    await initReaderFallback();
  }
}

/** Маршрут: /embed/:bookId → Встраиваемый ридер */
export async function handleEmbed({ bookId }) {
  cleanupLanding(); cleanupBookshelf(); cleanupReader(); hideAccount();
  document.body.dataset.screen = 'reader';

  if (ctx.useAPI) {
    await initReaderWithMode(bookId, 'embed');
  } else {
    const config = adminConfigStorage.load();
    config.activeBookId = bookId;
    if (!config.books) config.books = [];
    adminConfigStorage.setFull(config);
    await initReaderFallback();
  }
}

/** Маршрут: /account → Личный кабинет */
export async function handleAccount() {
  if (!ctx.currentUser) {
    ctx.router.navigate('/', { replace: true });
    return;
  }

  cleanupReader(); cleanupLanding(); cleanupBookshelf();

  const query = ctx.router.getCurrentRoute()?.query || new URLSearchParams(location.search);
  const tab = query.get('tab') || 'books';
  const editBookId = query.get('edit');
  const mode = query.get('mode');

  if (!ctx.state.accountScreen) {
    const { AccountScreen } = await import('../core/AccountScreen.js');
    ctx.state.accountScreen = new AccountScreen({ apiClient: ctx.apiClient, router: ctx.router, currentUser: ctx.currentUser });
    await ctx.state.accountScreen.init();
  }
  await ctx.state.accountScreen.show(tab, { editBookId, mode });
}

// ─── Инициализация ридера ───────────────────────────────────────────────────

async function initReaderWithMode(bookId, route) {
  let readerMode = 'guest';
  let config;
  let bookOwner = null;
  let progress = null;

  if (route === 'embed') {
    readerMode = 'embed';
    try {
      const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
      config = result.config;
      bookOwner = result.owner;
    } catch (err) {
      console.error('Ошибка загрузки книги (embed):', err);
      return;
    }
  } else if (ctx.currentUser) {
    try {
      config = await loadConfigFromAPI(ctx.apiClient, bookId);
      readerMode = 'owner';
      progress = await ctx.apiClient.getProgress(bookId).catch(() => null);
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        try {
          const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
          config = result.config;
          bookOwner = result.owner;
          readerMode = 'guest';
          progress = await ctx.apiClient.getProgress(bookId).catch(() => null);
        } catch (pubErr) {
          console.error('Ошибка загрузки публичной книги:', pubErr);
          ctx.router.navigate('/', { replace: true });
          return;
        }
      } else {
        console.error('Ошибка загрузки книги:', err);
        ctx.router.navigate('/', { replace: true });
        return;
      }
    }
  } else {
    readerMode = 'guest';
    try {
      const result = await loadPublicConfigFromAPI(ctx.apiClient, bookId);
      config = result.config;
      bookOwner = result.owner;
    } catch (err) {
      console.error('Ошибка загрузки публичной книги:', err);
      ctx.router.navigate('/', { replace: true });
      return;
    }
  }

  if (readerMode === 'embed') {
    config = { ...config, DEFAULT_SETTINGS: { ...config.DEFAULT_SETTINGS, soundEnabled: false } };
  }

  setConfig(config);

  ctx.state.app = new BookController(config, {
    apiClient: readerMode === 'embed' ? null : ctx.apiClient,
    bookId, serverProgress: progress, readerMode, bookOwner,
  });
  await ctx.state.app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl && readerMode !== 'embed') photoLightbox.attach(bookEl);
  if (readerMode !== 'embed') setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = ctx.state.app;
  }
}

async function initReaderFallback() {
  const enriched = await enrichConfigFromIDB(CONFIG);
  if (enriched !== CONFIG) setConfig(enriched);

  ctx.state.app = new BookController();
  await ctx.state.app.init();

  const bookEl = document.querySelector('.book');
  if (bookEl) photoLightbox.attach(bookEl);
  setupInstallButton();

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = ctx.state.app;
  }
}

/**
 * Экспортировать cleanup-функции для использования в index.js.
 */
export { cleanupReader, cleanupBookshelf, cleanupLanding, hideAccount };
