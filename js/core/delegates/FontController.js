/**
 * FONT CONTROLLER
 * Управление шрифтами: выбор, размер, загрузка кастомных шрифтов.
 * Выделен из SettingsDelegate для снижения cyclomatic complexity.
 */

import { CONFIG } from "../../config.js";
import { cssVars, announce } from "../../utils/index.js";

/** Названия шрифтов для объявления screen reader */
const FONT_NAMES = {
  georgia: 'Georgia',
  merriweather: 'Merriweather',
  'libre-baskerville': 'Libre Baskerville',
  inter: 'Inter',
  roboto: 'Roboto',
  'open-sans': 'Open Sans',
};

export class FontController {
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
   * Применить текущие настройки шрифта к DOM
   */
  apply() {
    const html = this._dom.get("html");
    if (!html) return;

    const font = this._settings.get("font");
    html.style.setProperty(
      "--reader-font-family",
      CONFIG.FONTS[font] || CONFIG.FONTS.georgia
    );

    const fontSize = this._settings.get("fontSize");
    html.style.setProperty(
      "--reader-font-size",
      `${fontSize}px`
    );

    this._loadCustomFonts();
  }

  /**
   * Обработать изменение шрифта
   * @param {string} fontKey
   * @returns {boolean} Требуется ли репагинация
   */
  handleFont(fontKey) {
    const html = this._dom.get("html");
    if (html) {
      html.style.setProperty(
        "--reader-font-family",
        CONFIG.FONTS[fontKey] || CONFIG.FONTS.georgia
      );
    }

    cssVars.invalidateCache();
    announce(`Шрифт: ${FONT_NAMES[fontKey] || fontKey}`);
    return true;
  }

  /**
   * Обработать изменение размера шрифта
   * @param {'increase'|'decrease'} action
   * @returns {boolean} Требуется ли репагинация
   */
  handleFontSize(action) {
    const current = this._settings.get("fontSize");
    const minSize = cssVars.getNumber("--font-min", 14);
    const maxSize = cssVars.getNumber("--font-max", 22);

    let newSize = current;
    if (action === "increase") {
      newSize = Math.min(current + 1, maxSize);
    } else if (action === "decrease") {
      newSize = Math.max(current - 1, minSize);
    }

    if (newSize !== current) {
      this._settings.set("fontSize", newSize);

      const html = this._dom.get("html");
      if (html) {
        html.style.setProperty("--reader-font-size", `${newSize}px`);
      }

      cssVars.invalidateCache();
      announce(`Размер шрифта: ${newSize}`);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════
  // ЗАГРУЗКА КАСТОМНЫХ ШРИФТОВ
  // ═══════════════════════════════════════════

  /**
   * Загрузить кастомные шрифты (декоративный + шрифты для чтения) через FontFace API.
   * @private
   */
  _loadCustomFonts() {
    const decorative = CONFIG.DECORATIVE_FONT;
    if (decorative?.dataUrl) {
      this._registerFont('CustomDecorativeFont', decorative.dataUrl).then(() => {
        const html = this._dom.get("html");
        if (html) {
          html.style.setProperty("--decorative-font", "CustomDecorativeFont, sans-serif");
        }
      });
    }

    const customFonts = CONFIG.CUSTOM_FONTS;
    if (customFonts?.length) {
      for (const f of customFonts) {
        const fontName = `CustomReading_${f.id}`;
        this._registerFont(fontName, f.dataUrl).then(() => {
          CONFIG.FONTS[f.id] = `${fontName}, ${f.family.split(',').pop().trim()}`;
        });
      }
    }

    this._populateFontSelect();
  }

  /**
   * Зарегистрировать шрифт через FontFace API
   * @private
   */
  _registerFont(familyName, dataUrl) {
    const fontFace = new FontFace(familyName, `url(${dataUrl})`);
    return fontFace.load().then((loaded) => {
      document.fonts.add(loaded);
    }).catch((err) => {
      console.warn(`Не удалось загрузить шрифт ${familyName}:`, err.message);
    });
  }

  /**
   * Заполнить <select> шрифтов из CONFIG.FONTS_LIST
   * @private
   */
  _populateFontSelect() {
    const fontsList = CONFIG.FONTS_LIST;
    if (!fontsList) return;

    const select = this._dom.get("fontSelect");
    if (!select) return;

    select.innerHTML = fontsList.map(f =>
      `<option value="${f.id}">${f.label}</option>`
    ).join('');

    const currentFont = this._settings.get("font");
    if (fontsList.some(f => f.id === currentFont)) {
      select.value = currentFont;
    } else if (fontsList.length > 0) {
      select.value = fontsList[0].id;
      this._settings.set("font", fontsList[0].id);
    }
  }
}
