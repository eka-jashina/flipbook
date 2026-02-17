/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 * Если в админке несколько книг и ни одна не выбрана —
 * показывается книжный шкаф вместо ридера.
 */

import { BookController } from './core/BookController.js';
import { BookshelfScreen, getBookshelfData, clearActiveBook } from './core/BookshelfScreen.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';
import { installPrompt } from './utils/InstallPrompt.js';
import { photoLightbox } from './utils/PhotoLightbox.js';

// Глобальная ссылка на контроллер (для отладки)
let app = null;
let bookshelf = null;

// Регистрация Service Worker для PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Показываем уведомление о доступном обновлении
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

  // Функция обновления видимости кнопки
  const updateVisibility = () => {
    if (installPrompt.canInstall) {
      installSection.hidden = false;
    } else {
      installSection.hidden = true;
    }
  };

  // Подписываемся на изменения состояния
  installPrompt.onStateChange((event) => {
    if (event === 'available') {
      updateVisibility();
    } else if (event === 'installed' || event === 'dismissed') {
      // После установки или отклонения всё ещё можем показывать кнопку
      updateVisibility();
    }
  });

  // Обработчик клика
  installBtn.addEventListener('click', async () => {
    installPrompt.resetDismissed();
    const installed = await installPrompt.install();
    if (!installed) {
      // Если пользователь отменил - показываем баннер позже
      console.log('Установка отменена пользователем');
    }
    updateVisibility();
  });

  // Начальная проверка
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
    onBookSelect: () => {
      // После сохранения activeBookId перезагружаем —
      // config.js подхватит новый activeBookId
      location.reload();
    },
  });

  bookshelf.render();
  bookshelf.show();
}

/**
 * Инициализация ридера (книги)
 */
async function initReader() {
  app = new BookController();
  await app.init();

  // Лайтбокс для фотоальбомов — привязать к контейнеру книги
  const bookEl = document.querySelector('.book');
  if (bookEl) {
    photoLightbox.attach(bookEl);
  }

  // Настраиваем кнопку установки PWA
  setupInstallButton();

  // Экспортируем в window для отладки
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.bookApp = app;
  }
}

/**
 * Показать баннер «Установить для Android», если:
 * - устройство Android
 * - не внутри Capacitor APK
 * - пользователь не закрывал баннер ранее
 */
function setupAndroidBanner() {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
  const dismissed = localStorage.getItem('android-banner-dismissed');

  if (!isAndroid || isCapacitor || dismissed) return;

  const banner = document.getElementById('androidBanner');
  const closeBtn = document.getElementById('androidBannerClose');
  if (!banner || !closeBtn) return;

  banner.hidden = false;

  closeBtn.addEventListener('click', () => {
    banner.hidden = true;
    localStorage.setItem('android-banner-dismissed', '1');
  });
}

/**
 * Инициализация приложения
 */
async function init() {
  try {
    setupAndroidBanner();

    // Проверяем, нужно ли показать книжный шкаф
    const { shouldShow, books } = getBookshelfData();

    if (shouldShow) {
      showBookshelf(books);
      return;
    }

    // Если есть несколько книг — показываем кнопку «К полке»
    if (books.length > 1) {
      document.body.dataset.hasBookshelf = 'true';
      setupBackToShelfButton();
    }

    await initReader();
  } catch (error) {
    console.error('Failed to initialize Book Reader:', error);
  }
}

/**
 * Очистка при выгрузке страницы
 */
function cleanup() {
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
