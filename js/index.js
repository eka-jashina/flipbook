/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 */

import { BookController } from './core/BookController.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';
import { installPrompt } from './utils/InstallPrompt.js';

// Глобальная ссылка на контроллер (для отладки)
let app = null;

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
  onRegisteredSW(swUrl, registration) {
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
 * Инициализация приложения
 */
async function init() {
  try {
    app = new BookController();
    await app.init();

    // Настраиваем кнопку установки PWA
    setupInstallButton();

    // Экспортируем в window для отладки
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      window.bookApp = app;
    }
  } catch (error) {
    console.error('Failed to initialize Book Reader:', error);
  }
}

/**
 * Очистка при выгрузке страницы
 */
function cleanup() {
  if (app) {
    app.destroy();
    app = null;
  }
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
