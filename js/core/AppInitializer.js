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
import { AmbientManager } from '../utils/AmbientManager.js';

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
    
    // Синхронизировать настройки шрифта
    const fontSelect = this.dom.get('fontSelect');
    const fontSizeValue = this.dom.get('fontSizeValue');

    if (fontSelect) fontSelect.value = this.settings.get("font");
    if (fontSizeValue) fontSizeValue.textContent = this.settings.get("fontSize");

    // Синхронизировать theme segmented control
    const themeSegmented = this.dom.get('themeSegmented');
    const savedTheme = this.settings.get("theme");

    if (themeSegmented) {
      const segments = themeSegmented.querySelectorAll('.theme-segment');
      segments.forEach(segment => {
        const isActive = segment.dataset.theme === savedTheme;
        segment.dataset.active = isActive;
        segment.setAttribute('aria-checked', isActive);
      });
    }

    // Синхронизировать контролы звука
    const soundToggle = this.dom.get('soundToggle');
    const volumeSlider = this.dom.get('volumeSlider');
    
    if (soundToggle) {
      soundToggle.checked = this.settings.get("soundEnabled");
    }
    
    if (volumeSlider) {
      volumeSlider.value = this.settings.get("soundVolume") * 100;
    }

    // Синхронизировать контролы ambient (новые pill buttons)
    const ambientPills = this.dom.get('ambientPills');
    const ambientVolume = this.dom.get('ambientVolume');
    const ambientVolumeWrapper = this.dom.get('ambientVolumeWrapper');

    if (ambientPills) {
      // Заполнить pills из конфигурации
      this._populateAmbientPills(ambientPills);

      const savedType = this.settings.get("ambientType");
      this._updateAmbientPillsState(ambientPills, savedType);

      // Показать/скрыть слайдер громкости в зависимости от типа
      if (ambientVolumeWrapper && savedType !== AmbientManager.TYPE_NONE) {
        ambientVolumeWrapper.classList.add('visible');
      }
    }

    if (ambientVolume) {
      const savedVolume = this.settings.get("ambientVolume");
      ambientVolume.value = savedVolume * 100;
    }

    // Состояние volume control для перелистывания управляется через CSS :has()
  }

  /**
   * Заполнить pill buttons для выбора ambient из конфигурации
   * @private
   * @param {HTMLElement} container
   */
  _populateAmbientPills(container) {
    container.innerHTML = '';

    const tmpl = document.getElementById('tmpl-ambient-pill');
    for (const [type, config] of Object.entries(CONFIG.AMBIENT)) {
      const frag = tmpl.content.cloneNode(true);
      const pill = frag.querySelector('.ambient-pill');
      pill.dataset.type = type;
      pill.setAttribute('aria-label', config.label);
      pill.querySelector('.ambient-pill-icon').textContent = config.icon || '🎵';
      pill.querySelector('.ambient-pill-label').textContent = config.shortLabel || config.label;
      container.appendChild(frag);
    }
  }

  /**
   * Обновить состояние активности pills
   * @private
   * @param {HTMLElement} container
   * @param {string} activeType
   */
  _updateAmbientPillsState(container, activeType) {
    const pills = container.querySelectorAll('.ambient-pill');
    pills.forEach(pill => {
      const isActive = pill.dataset.type === activeType;
      pill.dataset.active = isActive;
      pill.setAttribute('aria-checked', isActive);
    });
  }

  /**
   * Привязать все события
   * @private
   */
  _bindEvents() {
    const {
      nextBtn, prevBtn, tocBtn, continueBtn, cover,
      increaseBtn, decreaseBtn, fontSizeValue, fontSelect, themeSegmented, debugToggle,
      soundToggle, volumeSlider,
      ambientPills, ambientVolume, ambientVolumeWrapper,
      fullscreenBtn
    } = this.dom.elements;

    this.eventController.bind({
      nextBtn, prevBtn, tocBtn, continueBtn,
      coverEl: cover,
      increaseBtn, decreaseBtn, fontSizeValue, fontSelect, themeSegmented, debugToggle,
      soundToggle, volumeSlider,
      ambientPills, ambientVolume, ambientVolumeWrapper,
      fullscreenBtn
    });

    this.dragDelegate.bind();
  }
}
