/**
 * MAIN ENTRY POINT
 *
 * Инициализация приложения после загрузки DOM.
 */

import { BookController } from './core/BookController.js';

// Глобальная ссылка на контроллер (для отладки)
let app = null;

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

    console.log('📖 Book Reader initialized');
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
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Очистка при закрытии/переходе
window.addEventListener('beforeunload', cleanup);
