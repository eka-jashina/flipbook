/**
 * ERROR HANDLER
 * Централизованная обработка и отображение ошибок.
 *
 * Особенности:
 * - Показ ошибок пользователю через UI-элемент
 * - Автоматическое скрытие через настраиваемый таймаут
 * - Fallback на динамический элемент если UI недоступен
 * - Логирование в консоль для отладки
 */

import { CONFIG } from '../config.js';

export class ErrorHandler {
  static _hideTimer = null;

  /**
   * Показать сообщение об ошибке пользователю
   * @param {string} message - Текст ошибки для отображения
   */
  static show(message) {
    const error = document.getElementById('errorMessage');
    const text = document.getElementById('errorText');

    // Fallback на старое поведение если элементы не найдены
    if (!error || !text) {
      console.error('Error message container not found in DOM');
      this._showFallback(message);
      return;
    }

    // Отменяем предыдущий таймаут чтобы не накапливались
    clearTimeout(this._hideTimer);

    text.textContent = message;
    error.hidden = false;

    // Автоматически скрываем через заданный таймаут
    this._hideTimer = setTimeout(() => {
      error.hidden = true;
      this._hideTimer = null;
    }, CONFIG.UI.ERROR_HIDE_TIMEOUT);
  }

  /**
   * Обработать ошибку: залогировать и показать пользователю
   * @param {Error} error - Объект ошибки
   * @param {string} userMessage - Сообщение для пользователя
   */
  static handle(error, userMessage = "Произошла ошибка") {
    console.error("Error:", error);
    this.show(userMessage);
  }

  /**
   * Fallback-отображение ошибки через динамический элемент
   * Используется если основной UI-элемент недоступен
   * @private
   * @param {string} message - Текст ошибки
   */
  static _showFallback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.setAttribute("role", "alert");
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), CONFIG.UI.ERROR_HIDE_TIMEOUT);
  }
}
