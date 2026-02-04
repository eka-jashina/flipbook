/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 */

import { BookController } from './core/BookController.js';
import { registerSW } from 'virtual:pwa-register';
import { offlineIndicator } from './utils/OfflineIndicator.js';

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
 * Инициализация приложения
 */
async function init() {
  try {
    app = new BookController();
    await app.init();

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
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Очистка при закрытии/переходе
window.addEventListener('beforeunload', cleanup);
