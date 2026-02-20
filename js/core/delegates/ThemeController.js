/**
 * THEME CONTROLLER
 * Управление темами, оформлением и видимостью настроек.
 * Выделен из SettingsDelegate для снижения cyclomatic complexity.
 */

import { CONFIG } from "../../config.js";
import { announce } from "../../utils/index.js";

/** Названия тем для объявления screen reader */
const THEME_NAMES = {
  light: 'Светлая тема',
  dark: 'Тёмная тема',
  bw: 'Чёрно-белая тема',
};

export class ThemeController {
  /**
   * @param {Object} deps
   * @param {Object} deps.dom - DOMManager
   * @param {Object} deps.settings - SettingsManager
   */
  constructor(deps) {
    this._dom = deps.dom;
    this._settings = deps.settings;
  }

  /**
   * Применить текущую тему к DOM
   */
  apply() {
    const html = this._dom.get("html");
    if (!html) return;

    const theme = this._settings.get("theme");
    html.dataset.theme = theme === "light" ? "" : theme;

    this._applyAppearance();
    this._applySettingsVisibility();
  }

  /**
   * Обработать изменение темы
   * @param {string} theme
   */
  handleTheme(theme) {
    const html = this._dom.get("html");
    if (html) {
      html.dataset.theme = theme === "light" ? "" : theme;
    }

    this._applyAppearance();
    announce(THEME_NAMES[theme] || theme);
  }

  // ═══════════════════════════════════════════
  // ОФОРМЛЕНИЕ ИЗ АДМИНКИ
  // ═══════════════════════════════════════════

  /**
   * Применить настройки оформления из CONFIG.APPEARANCE к CSS-переменным.
   * @private
   */
  _applyAppearance() {
    const html = this._dom.get("html");
    if (!html) return;

    const a = CONFIG.APPEARANCE;
    if (!a) return;

    const cover = this._dom.get("cover");
    if (cover) {
      const spans = cover.querySelectorAll(".cover-front h1 span");
      if (spans.length >= 2) {
        spans[0].textContent = a.coverTitle;
        spans[1].textContent = a.coverAuthor;
      }
    }

    const currentTheme = this._settings.get("theme");
    const themeKey = currentTheme === "dark" ? "dark" : "light";
    const t = a[themeKey] || a.light;

    if (t.coverBgImage) {
      html.style.setProperty("--cover-front-bg", `url(${t.coverBgImage})`);
    } else {
      html.style.setProperty("--cover-front-bg", `linear-gradient(135deg, ${t.coverBgStart}, ${t.coverBgEnd})`);
    }
    html.style.setProperty("--cover-front-text", t.coverText);

    if (t.pageTexture === "custom" && t.customTextureData) {
      html.style.setProperty("--bg-page-image", `url(${t.customTextureData})`);
    } else if (t.pageTexture === "none") {
      html.style.setProperty("--bg-page-image", "none");
    } else {
      html.style.removeProperty("--bg-page-image");
    }

    html.style.setProperty("--bg-page", t.bgPage);
    html.style.setProperty("--bg-app", t.bgApp);

    html.style.setProperty("--font-min", `${a.fontMin}px`);
    html.style.setProperty("--font-max", `${a.fontMax}px`);
  }

  // ═══════════════════════════════════════════
  // ВИДИМОСТЬ НАСТРОЕК
  // ═══════════════════════════════════════════

  /**
   * Скрыть/показать секции пользовательских настроек по конфигу из админки.
   * @private
   */
  _applySettingsVisibility() {
    const v = CONFIG.SETTINGS_VISIBILITY;
    if (!v) return;

    const sections = document.querySelectorAll('[data-setting]');
    sections.forEach(section => {
      const key = section.dataset.setting;
      if (key in v) {
        section.hidden = !v[key];
      }
    });

    const settingsPod = document.querySelector('.settings-pod');
    if (settingsPod) {
      const visibleSections = settingsPod.querySelectorAll('.settings-section:not([hidden])');
      settingsPod.hidden = visibleSections.length === 0;
    }

    const audioPod = document.querySelector('.audio-pod');
    if (audioPod) {
      const visibleSections = audioPod.querySelectorAll('.audio-section:not([hidden])');
      audioPod.hidden = visibleSections.length === 0;
    }
  }
}
