/**
 * SETTINGS DELEGATE
 * Управление применением и изменением настроек.
 * 
 * Обновлено для работы с DOMManager.
 */

import { CONFIG } from '../../config.js';
import { cssVars } from '../../utils/CSSVariables.js';

export class SettingsDelegate {
  constructor(controller) {
    this.ctrl = controller;
  }

  /**
   * Получить DOM элементы
   * @returns {Object}
   */
  get elements() {
    return this.ctrl.dom.elements;
  }

  /**
   * Получить менеджер настроек
   * @returns {SettingsManager}
   */
  get settings() {
    return this.ctrl.settings;
  }

  /**
   * Применить все настройки к DOM
   */
  apply() {
    const html = this.ctrl.dom.get('html');
    if (!html) {
      console.error('HTML element not found');
      return;
    }

    html.style.setProperty(
      "--reader-font-family",
      CONFIG.FONTS[this.settings.get("font")]
    );

    html.style.setProperty(
      "--reader-font-size",
      `${this.settings.get("fontSize")}px`
    );

    const theme = this.settings.get("theme");
    html.dataset.theme = theme === "light" ? "" : theme;

    cssVars.invalidateCache();
  }

  /**
   * Обработать изменение настройки
   * @param {string} key
   * @param {*} value
   */
  handleChange(key, value) {
    switch (key) {
      case "fontSize":
        this._handleFontSize(value);
        break;
      case "font":
        this._handleFont(value);
        break;
      case "theme":
        this._handleTheme(value);
        break;
      case "debug":
        this.ctrl.debugPanel.toggle();
        this.ctrl._updateDebug();
        break;
    }
  }

  /**
   * Обработать изменение размера шрифта
   * @private
   * @param {'increase'|'decrease'} action
   */
  _handleFontSize(action) {
    const current = this.settings.get("fontSize");
    const minSize = cssVars.getNumber("--font-min", 14);
    const maxSize = cssVars.getNumber("--font-max", 22);
    
    const newSize = action === "increase"
      ? Math.min(current + 1, maxSize)
      : Math.max(current - 1, minSize);

    this.settings.set("fontSize", newSize);
    
    const html = this.ctrl.dom.get('html');
    if (html) {
      html.style.setProperty("--reader-font-size", `${newSize}px`);
    }
    
    this.ctrl._repaginate(true);
  }

  /**
   * Обработать изменение шрифта
   * @private
   * @param {string} value
   */
  _handleFont(value) {
    this.settings.set("font", value);
    
    const html = this.ctrl.dom.get('html');
    if (html) {
      html.style.setProperty("--reader-font-family", CONFIG.FONTS[value]);
    }
    
    this.ctrl._repaginate(true);
  }

  /**
   * Обработать изменение темы
   * @private
   * @param {string} value
   */
  _handleTheme(value) {
    this.settings.set("theme", value);
    
    const html = this.ctrl.dom.get('html');
    if (html) {
      html.dataset.theme = value === "light" ? "" : value;
    }
    
    cssVars.invalidateCache();
  }
}
