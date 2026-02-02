/**
 * AUDIO SERVICES
 * Группирует компоненты для работы со звуком.
 *
 * Содержит:
 * - SoundManager - звуковые эффекты (перелистывание, открытие/закрытие)
 * - AmbientManager - фоновые звуки (дождь, камин, кафе)
 */

import { SoundManager } from '../../utils/SoundManager.js';
import { AmbientManager } from '../../utils/AmbientManager.js';
import { CONFIG } from '../../config.js';

export class AudioServices {
  /**
   * @param {Object} settings - SettingsManager для получения настроек звука
   */
  constructor(settings) {
    this.soundManager = this._createSoundManager(settings);
    this.ambientManager = this._createAmbientManager(settings);
  }

  /**
   * Создать менеджер звуковых эффектов
   * @private
   */
  _createSoundManager(settings) {
    const soundManager = new SoundManager({
      enabled: settings.get("soundEnabled"),
      volume: settings.get("soundVolume"),
    });

    // Регистрируем звуки
    soundManager
      .register("pageFlip", CONFIG.SOUNDS.pageFlip, {
        preload: true,
        poolSize: 3,
      })
      .register("bookOpen", CONFIG.SOUNDS.bookOpen, {
        preload: true,
        poolSize: 1,
      })
      .register("bookClose", CONFIG.SOUNDS.bookClose, {
        preload: true,
        poolSize: 1,
      });

    return soundManager;
  }

  /**
   * Создать менеджер ambient звуков
   * @private
   */
  _createAmbientManager(settings) {
    const ambientManager = new AmbientManager({
      currentType: settings.get("ambientType"),
      volume: settings.get("ambientVolume"),
    });

    // Регистрируем ambient звуки из конфигурации
    for (const [type, config] of Object.entries(CONFIG.AMBIENT)) {
      if (config.file) {
        ambientManager.register(type, config.file);
      }
    }

    return ambientManager;
  }

  /**
   * Настроить коллбэки загрузки для ambient pills
   * @param {HTMLElement} ambientPills - Контейнер с кнопками ambient
   */
  setupAmbientLoadingCallbacks(ambientPills) {
    if (!ambientPills) return;

    const setPillLoading = (type, isLoading) => {
      const pill = ambientPills.querySelector(`[data-type="${type}"]`);
      if (pill) {
        pill.dataset.loading = isLoading;
      }
    };

    this.ambientManager.onLoadStart = (type) => setPillLoading(type, true);
    this.ambientManager.onLoadEnd = (type) => setPillLoading(type, false);
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.soundManager?.destroy?.();
    this.ambientManager?.destroy?.();

    this.soundManager = null;
    this.ambientManager = null;
  }
}
