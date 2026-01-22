/**
 * Делегат настроек.
 */

import { CONFIG } from '../../config.js';
import { cssVars } from '../../utils/CSSVariables.js';

export class SettingsDelegate {
  constructor(controller) {
    this.ctrl = controller;
  }

  get elements() { return this.ctrl.elements; }
  get settings() { return this.ctrl.settings; }

  /**
   * Применить все настройки к DOM
   */
  apply() {
    const { html } = this.elements;

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

  _handleFontSize(action) {
    const current = this.settings.get("fontSize");
    const minSize = cssVars.getNumber("--font-min", 14);
    const maxSize = cssVars.getNumber("--font-max", 22);
    
    const newSize = action === "increase"
      ? Math.min(current + 1, maxSize)
      : Math.max(current - 1, minSize);

    this.settings.set("fontSize", newSize);
    this.elements.html.style.setProperty("--reader-font-size", `${newSize}px`);
    this.ctrl._repaginate(true);
  }

  _handleFont(value) {
    this.settings.set("font", value);
    this.elements.html.style.setProperty("--reader-font-family", CONFIG.FONTS[value]);
    this.ctrl._repaginate(true);
  }

  _handleTheme(value) {
    this.settings.set("theme", value);
    this.elements.html.dataset.theme = value === "light" ? "" : value;
    cssVars.invalidateCache();
  }
}