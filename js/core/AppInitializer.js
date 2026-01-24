/**
 * APP INITIALIZER
 * Управляет процессом инициализации приложения.
 * 
 * Последовательность инициализации:
 * 1. Применение настроек к DOM
 * 2. Настройка UI (фон, кнопки)
 * 3. Привязка событий
 * 4. Ожидание загрузки шрифтов
 * 5. Предзагрузка обложки
 */

import { CONFIG } from '../config.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class AppInitializer {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.dom = context.dom;
    this.settings = context.settings;
    this.settingsDelegate = context.settingsDelegate;
    this.backgroundManager = context.backgroundManager;
    this.eventController = context.eventController;
    this.dragDelegate = context.dragDelegate;
    this.lifecycleDelegate = context.lifecycleDelegate;
  }

  /**
   * Инициализировать приложение
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this._applySettings();
      this._setupUI();
      this._bindEvents();
      
      await document.fonts.ready;
      await this.lifecycleDelegate.init();
    } catch (error) {
      ErrorHandler.handle(error, "Ошибка инициализации");
      throw error;
    }
  }

  /**
   * Применить сохраненные настройки к DOM
   * @private
   */
  _applySettings() {
    this.settingsDelegate.apply();
  }

  /**
   * Настроить начальное состояние UI
   * @private
   */
  _setupUI() {
    // Установить фон обложки
    this.backgroundManager.setBackground(CONFIG.COVER_BG);
    this.dom.get('body').dataset.chapter = "cover";
    
    // Показать кнопку "Продолжить" если есть сохраненная позиция
    const savedPage = this.settings.get("page");
    if (savedPage > 0) {
      const continueBtn = this.dom.get('continueBtn');
      if (continueBtn) continueBtn.hidden = false;
    }
    
    // Синхронизировать селекты с настройками
    const fontSelect = this.dom.get('fontSelect');
    const themeSelect = this.dom.get('themeSelect');
    
    if (fontSelect) fontSelect.value = this.settings.get("font");
    if (themeSelect) themeSelect.value = this.settings.get("theme");
  }

  /**
   * Привязать все события
   * @private
   */
  _bindEvents() {
    const {
      nextBtn, prevBtn, tocBtn, continueBtn, cover,
      increaseBtn, decreaseBtn, fontSelect, themeSelect, debugToggle
    } = this.dom.elements;

    this.eventController.bind({
      nextBtn, prevBtn, tocBtn, continueBtn,
      coverEl: cover,
      increaseBtn, decreaseBtn, fontSelect, themeSelect, debugToggle,
    });

    this.dragDelegate.bind();
  }
}
