/**
 * SETTINGS DELEGATE
 * Управление применением и изменением настроек.
 *
 * Обновлено для работы с DOMManager и звуком.
 */

import { CONFIG } from "../../config.js";
import { cssVars } from "../../utils/CSSVariables.js";

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
    const html = this.ctrl.dom.get("html");
    if (!html) {
      console.error("HTML element not found");
      return;
    }

    html.style.setProperty(
      "--reader-font-family",
      CONFIG.FONTS[this.settings.get("font")],
    );

    html.style.setProperty(
      "--reader-font-size",
      `${this.settings.get("fontSize")}px`,
    );

    const theme = this.settings.get("theme");
    html.dataset.theme = theme === "light" ? "" : theme;

    // Применить настройки звука
    if (this.ctrl.soundManager) {
      this.ctrl.soundManager.setEnabled(this.settings.get("soundEnabled"));
      this.ctrl.soundManager.setVolume(this.settings.get("soundVolume"));
    }

    // Применить настройки ambient
    if (this.ctrl.ambientManager) {
      this.ctrl.ambientManager.setVolume(this.settings.get("ambientVolume"));
      const ambientType = this.settings.get("ambientType");
      if (ambientType !== "none") {
        this.ctrl.ambientManager.setType(ambientType, false);
      }
    }

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
      case "soundEnabled":
        this._handleSoundToggle(value);
        break;
      case "soundVolume":
        this._handleSoundVolume(value);
        break;
      case "debug":
        this.ctrl.debugPanel.toggle();
        this.ctrl._updateDebug();
        break;
      case "ambientType":
        this._handleAmbientType(value);
        break;
      case "ambientVolume":
        this._handleAmbientVolume(value);
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

    const newSize =
      action === "increase"
        ? Math.min(current + 1, maxSize)
        : Math.max(current - 1, minSize);

    this.settings.set("fontSize", newSize);

    const html = this.ctrl.dom.get("html");
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

    const html = this.ctrl.dom.get("html");
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

    const html = this.ctrl.dom.get("html");
    if (html) {
      html.dataset.theme = value === "light" ? "" : value;
    }

    cssVars.invalidateCache();
  }

  /**
   * Обработать включение/выключение звука
   * @private
   * @param {boolean|'toggle'} value
   */
  _handleSoundToggle(value) {
    const current = this.settings.get("soundEnabled");
    const newValue = value === "toggle" ? !current : value;

    this.settings.set("soundEnabled", newValue);

    if (this.ctrl.soundManager) {
      this.ctrl.soundManager.setEnabled(newValue);
    }

    // Воспроизводим тестовый звук если включили
    if (newValue && this.ctrl.soundManager) {
      this.ctrl.soundManager.play("pageFlip", { volume: 0.2 });
    }
  }

  /**
   * Обработать изменение громкости
   * @private
   * @param {number|'increase'|'decrease'} value
   */
  _handleSoundVolume(value) {
    let newVolume;

    if (typeof value === "number") {
      newVolume = Math.max(0, Math.min(1, value));
    } else {
      const current = this.settings.get("soundVolume");
      newVolume =
        value === "increase"
          ? Math.min(current + 0.1, 1)
          : Math.max(current - 0.1, 0);
    }

    this.settings.set("soundVolume", newVolume);

    if (this.ctrl.soundManager) {
      this.ctrl.soundManager.setVolume(newVolume);
      // Воспроизводим тестовый звук
      this.ctrl.soundManager.play("pageFlip", { volume: newVolume });
    }
  }

  /**
   * Обработать изменение типа ambient звука
   * @private
   * @param {string} value
   */
  _handleAmbientType(value) {
    this.settings.set("ambientType", value);

    if (this.ctrl.ambientManager) {
      this.ctrl.ambientManager.setType(value);
    }

    // Обновить UI - показать/скрыть слайдер громкости
    const wrapper = this.ctrl.dom.get("ambientVolumeWrapper");
    const controls = wrapper?.closest(".ambient-controls");

    if (controls) {
      if (value === "none") {
        controls.classList.remove("has-ambient");
      } else {
        controls.classList.add("has-ambient");
      }
    }
  }

  /**
   * Обработать изменение громкости ambient
   * @private
   * @param {number} value
   */
  _handleAmbientVolume(value) {
    const newVolume = Math.max(0, Math.min(1, value));
    this.settings.set("ambientVolume", newVolume);

    if (this.ctrl.ambientManager) {
      this.ctrl.ambientManager.setVolume(newVolume);
    }

    // Обновить label
    const label = this.ctrl.dom.get("ambientVolumeLabel");
    if (label) {
      label.textContent = `${Math.round(newVolume * 100)}%`;
    }
  }
}
