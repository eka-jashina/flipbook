/**
 * SETTINGS DELEGATE - REFACTORED
 * Управление применением и изменением настроек.
 */

import { CONFIG } from "../../config.js";
import { cssVars, announce } from "../../utils/index.js";
import { BaseDelegate, DelegateEvents } from './BaseDelegate.js';

export class SettingsDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {DOMManager} deps.dom
   * @param {SettingsManager} deps.settings
   * @param {SoundManager} deps.soundManager
   * @param {AmbientManager} deps.ambientManager
   * @param {DebugPanel} deps.debugPanel
   */
  constructor(deps) {
    super(deps);
    this.debugPanel = deps.debugPanel;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['dom', 'settings'],
      'SettingsDelegate'
    );
  }

  /**
   * Применить все настройки к DOM
   */
  apply() {
    const html = this.dom.get("html");
    if (!html) {
      console.error("SettingsDelegate: HTML element not found");
      return;
    }

    // Применить шрифт
    const font = this.settings.get("font");
    html.style.setProperty(
      "--reader-font-family",
      CONFIG.FONTS[font] || CONFIG.FONTS.georgia
    );

    // Применить размер шрифта
    const fontSize = this.settings.get("fontSize");
    html.style.setProperty(
      "--reader-font-size",
      `${fontSize}px`
    );

    // Применить тему
    const theme = this.settings.get("theme");
    html.dataset.theme = theme === "light" ? "" : theme;

    // Применить настройки звука
    if (this.soundManager) {
      this.soundManager.setEnabled(this.settings.get("soundEnabled"));
      this.soundManager.setVolume(this.settings.get("soundVolume"));
    }

    // Применить настройки ambient
    // НЕ запускаем воспроизведение здесь — на мобильных браузерах
    // audio требует user gesture. Воспроизведение запустится
    // после первого взаимодействия (открытия книги).
    if (this.ambientManager) {
      this.ambientManager.setVolume(this.settings.get("ambientVolume"));
    }

    // Применить настройки оформления из админки
    this._applyAppearance();

    cssVars.invalidateCache();
  }

  /**
   * Обработать изменение настройки
   * @param {string} key
   * @param {*} value
   */
  handleChange(key, value) {
    // Для action-параметров (increase/decrease) не сохраняем напрямую —
    // обработчики сами вычислят и сохранят новое значение
    const isActionValue = value === "increase" || value === "decrease";
    if (!isActionValue) {
      this.settings.set(key, value);
    }

    // Обрабатываем специфичные для настройки действия
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
        this._handleDebug();
        break;
      case "ambientType":
        this._handleAmbientType(value);
        break;
      case "ambientVolume":
        this._handleAmbientVolume(value);
        break;
      case "fullscreen":
        this._handleFullscreen();
        break;
    }

    // Уведомляем контроллер об обновлении
    this.emit(DelegateEvents.SETTINGS_UPDATE);
  }

  // ═══════════════════════════════════════════
  // ОБРАБОТЧИКИ КОНКРЕТНЫХ НАСТРОЕК
  // ═══════════════════════════════════════════

  /**
   * Обработать изменение размера шрифта
   * @private
   * @param {'increase'|'decrease'} action
   */
  _handleFontSize(action) {
    const current = this.settings.get("fontSize");
    const minSize = cssVars.getNumber("--font-min", 14);
    const maxSize = cssVars.getNumber("--font-max", 22);

    let newSize = current;
    if (action === "increase") {
      newSize = Math.min(current + 1, maxSize);
    } else if (action === "decrease") {
      newSize = Math.max(current - 1, minSize);
    }

    if (newSize !== current) {
      this.settings.set("fontSize", newSize);

      const html = this.dom.get("html");
      if (html) {
        html.style.setProperty("--reader-font-size", `${newSize}px`);
      }

      cssVars.invalidateCache();
      announce(`Размер шрифта: ${newSize}`);

      // Требуется репагинация
      if (this.isOpened) {
        this.emit(DelegateEvents.REPAGINATE, true);
      }
    }
  }

  /**
   * Обработать изменение шрифта
   * @private
   * @param {string} fontKey
   */
  _handleFont(fontKey) {
    const html = this.dom.get("html");
    if (html) {
      html.style.setProperty(
        "--reader-font-family",
        CONFIG.FONTS[fontKey] || CONFIG.FONTS.georgia
      );
    }

    cssVars.invalidateCache();

    // Названия шрифтов для объявления
    const fontNames = {
      georgia: 'Georgia',
      merriweather: 'Merriweather',
      'libre-baskerville': 'Libre Baskerville',
      inter: 'Inter',
      roboto: 'Roboto',
      'open-sans': 'Open Sans',
    };
    announce(`Шрифт: ${fontNames[fontKey] || fontKey}`);

    // Требуется репагинация
    if (this.isOpened) {
      this.emit(DelegateEvents.REPAGINATE, true);
    }
  }

  /**
   * Обработать изменение темы
   * @private
   * @param {string} theme
   */
  _handleTheme(theme) {
    const html = this.dom.get("html");
    if (html) {
      html.dataset.theme = theme === "light" ? "" : theme;
    }

    // Названия тем для объявления
    const themeNames = {
      light: 'Светлая тема',
      dark: 'Тёмная тема',
      bw: 'Чёрно-белая тема',
    };
    announce(themeNames[theme] || theme);
  }

  /**
   * Обработать переключение звука
   * @private
   * @param {boolean} enabled
   */
  _handleSoundToggle(enabled) {
    if (this.soundManager) {
      this.soundManager.setEnabled(enabled);
    }
  }

  /**
   * Обработать изменение громкости звука
   * @private
   * @param {'increase'|'decrease'|number} action
   */
  _handleSoundVolume(action) {
    if (!this.soundManager) return;

    // Для числовых значений - сразу применяем (уже сохранено в handleChange)
    if (typeof action === "number") {
      const volume = Math.max(0, Math.min(action, 1));
      this.soundManager.setVolume(volume);
      return;
    }

    // Для increase/decrease - вычисляем и сохраняем
    const current = this.settings.get("soundVolume");
    const step = 0.1;
    let newVolume = current;

    if (action === "increase") {
      newVolume = Math.min(current + step, 1);
    } else if (action === "decrease") {
      newVolume = Math.max(current - step, 0);
    }

    if (newVolume !== current) {
      this.settings.set("soundVolume", newVolume);
      this.soundManager.setVolume(newVolume);
    }
  }

  /**
   * Обработать переключение отладки
   * @private
   */
  _handleDebug() {
    if (this.debugPanel) {
      this.debugPanel.toggle();
    }
  }

  /**
   * Обработать изменение типа ambient звука
   * @private
   * @param {string} type
   */
  _handleAmbientType(type) {
    if (this.ambientManager) {
      this.ambientManager.setType(type, true);
    }
  }

  /**
   * Обработать изменение громкости ambient
   * @private
   * @param {number} volume
   */
  _handleAmbientVolume(volume) {
    if (this.ambientManager) {
      this.ambientManager.setVolume(volume);
    }
  }

  /**
   * Переключить полноэкранный режим
   * @private
   */
  _handleFullscreen() {
    const el = document.documentElement;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
      const request = el.requestFullscreen || el.webkitRequestFullscreen;
      if (request) {
        request.call(el).catch((err) => {
          console.warn("Не удалось войти в полноэкранный режим:", err.message);
        });
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        exit.call(document).catch((err) => {
          console.warn("Не удалось выйти из полноэкранного режима:", err.message);
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // ОФОРМЛЕНИЕ ИЗ АДМИНКИ
  // ═══════════════════════════════════════════

  /**
   * Применить настройки оформления из CONFIG.APPEARANCE к CSS-переменным.
   * Значения задаются в админке (admin.html) и читаются через config.js.
   * @private
   */
  _applyAppearance() {
    const html = this.dom.get("html");
    if (!html) return;

    const a = CONFIG.APPEARANCE;
    if (!a) return;

    // Заголовок и автор на обложке
    const cover = this.dom.get("cover");
    if (cover) {
      const spans = cover.querySelectorAll(".cover-front h1 span");
      if (spans.length >= 2) {
        spans[0].textContent = a.coverTitle;
        spans[1].textContent = a.coverAuthor;
      }
    }

    // Фон обложки: градиент или изображение
    if (a.coverBgImage) {
      html.style.setProperty("--cover-front-bg", `url(${a.coverBgImage})`);
    } else {
      html.style.setProperty("--cover-front-bg", `linear-gradient(135deg, ${a.coverBgStart}, ${a.coverBgEnd})`);
    }
    html.style.setProperty("--cover-front-text", a.coverText);

    if (a.pageTexture === "custom" && a.customTextureData) {
      html.style.setProperty("--bg-page-image", `url(${a.customTextureData})`);
    } else if (a.pageTexture === "none") {
      html.style.setProperty("--bg-page-image", "none");
    }

    html.style.setProperty("--bg-page", a.bgPage);
    html.style.setProperty("--bg-app", a.bgApp);
    html.style.setProperty("--font-min", `${a.fontMin}px`);
    html.style.setProperty("--font-max", `${a.fontMax}px`);
  }

  /**
   * Очистка
   */
  destroy() {
    this.debugPanel = null;
    super.destroy();
  }
}
