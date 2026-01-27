/**
 * AMBIENT MANAGER
 * Управление фоновыми звуками окружения.
 * 
 * Особенности:
 * - Зацикленное воспроизведение
 * - Автоматическая пауза при сворачивании вкладки
 * - Плавные переходы между треками
 * - Независимая регулировка громкости
 */

export class AmbientManager {
  /**
   * Тип "без звука" - используется как значение по умолчанию
   */
  static TYPE_NONE = 'none';

  /**
   * @param {Object} options
   * @param {string} options.currentType - Текущий тип звука
   * @param {number} options.volume - Громкость (0-1)
   * @param {Object} options.sounds - Карта типов к URL файлов
   */
  constructor(options = {}) {
    this.currentType = options.currentType ?? AmbientManager.TYPE_NONE;
    this.volume = options.volume ?? 0.5;
    this.sounds = options.sounds ?? {};
    
    this.audio = null;
    this.isPlaying = false;
    this.fadeInterval = null;
    
    this._boundVisibilityHandler = this._handleVisibilityChange.bind(this);
    this._setupVisibilityListener();
  }

  /**
   * Зарегистрировать ambient звук
   * @param {string} type - Тип звука
   * @param {string} url - URL аудио файла
   * @returns {AmbientManager}
   */
  register(type, url) {
    this.sounds[type] = url;
    return this;
  }

  /**
   * Установить тип ambient звука
   * @param {string} type - Тип звука
   * @param {boolean} fade - Использовать плавный переход
   */
  async setType(type, fade = true) {
    // Если тот же тип - ничего не делаем
    if (type === this.currentType && this.isPlaying) {
      return;
    }

    this.currentType = type;

    // Если выбрано "без звука" или тип без файла - останавливаем
    if (type === AmbientManager.TYPE_NONE || !this.sounds[type]) {
      await this.stop(fade);
      return;
    }

    // Если есть звук для этого типа - запускаем
    if (this.sounds[type]) {
      await this.play(type, fade);
    }
  }

  /**
   * Воспроизвести ambient звук
   * @param {string} type - Тип звука
   * @param {boolean} fade - Использовать fade in
   */
  async play(type, fade = true) {
    const url = this.sounds[type];
    if (!url) {
      console.warn(`Ambient sound "${type}" not registered`);
      return;
    }

    // Останавливаем текущий звук
    if (this.audio) {
      await this.stop(fade);
    }

    try {
      this.audio = new Audio(url);
      this.audio.loop = true;
      this.audio.volume = fade ? 0 : this.volume;
      this.audio.preload = 'auto';

      // Ждём загрузки
      await new Promise((resolve, reject) => {
        this.audio.addEventListener('canplaythrough', resolve, { once: true });
        this.audio.addEventListener('error', (e) => {
          reject(new Error(`Failed to load ambient sound: ${e.message}`));
        }, { once: true });
      });

      // Запускаем воспроизведение
      await this.audio.play();
      this.isPlaying = true;
      this.currentType = type;

      // Плавное появление
      if (fade) {
        await this._fadeIn();
      }
    } catch (error) {
      // Игнорируем ошибки autoplay policy
      if (error.name !== 'NotAllowedError') {
        console.warn('Failed to play ambient sound:', error);
      }
      this.isPlaying = false;
    }
  }

  /**
   * Остановить воспроизведение
   * @param {boolean} fade - Использовать fade out
   */
  async stop(fade = true) {
    if (!this.audio) return;

    if (fade && this.isPlaying) {
      await this._fadeOut();
    }

    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio = null;
    this.isPlaying = false;
  }

  /**
   * Пауза воспроизведения
   */
  pause() {
    if (this.audio && this.isPlaying) {
      this.audio.pause();
    }
  }

  /**
   * Возобновить воспроизведение
   */
  resume() {
    if (this.audio && this.isPlaying && this.audio.paused) {
      this.audio.play().catch(() => {
        // Игнорируем ошибки autoplay
      });
    }
  }

  /**
   * Установить громкость
   * @param {number} volume - Громкость (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.audio && this.isPlaying) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Получить текущий тип
   * @returns {string}
   */
  getType() {
    return this.currentType;
  }

  /**
   * Получить текущую громкость
   * @returns {number}
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Проверить, воспроизводится ли звук
   * @returns {boolean}
   */
  getIsPlaying() {
    return this.isPlaying && this.audio && !this.audio.paused;
  }

  /**
   * Плавное увеличение громкости
   * @private
   */
  _fadeIn() {
    return new Promise((resolve) => {
      this._clearFade();
      
      const targetVolume = this.volume;
      const step = targetVolume / 20; // 20 шагов
      let currentVolume = 0;

      this.fadeInterval = setInterval(() => {
        currentVolume = Math.min(currentVolume + step, targetVolume);
        
        if (this.audio) {
          this.audio.volume = currentVolume;
        }

        if (currentVolume >= targetVolume) {
          this._clearFade();
          resolve();
        }
      }, 50); // 50ms × 20 = 1 секунда fade
    });
  }

  /**
   * Плавное уменьшение громкости
   * @private
   */
  _fadeOut() {
    return new Promise((resolve) => {
      this._clearFade();
      
      if (!this.audio) {
        resolve();
        return;
      }

      let currentVolume = this.audio.volume;
      const step = currentVolume / 20;

      this.fadeInterval = setInterval(() => {
        currentVolume = Math.max(currentVolume - step, 0);
        
        if (this.audio) {
          this.audio.volume = currentVolume;
        }

        if (currentVolume <= 0) {
          this._clearFade();
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Очистить fade интервал
   * @private
   */
  _clearFade() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Настроить слушатель видимости вкладки
   * @private
   */
  _setupVisibilityListener() {
    document.addEventListener('visibilitychange', this._boundVisibilityHandler);
  }

  /**
   * Обработчик изменения видимости вкладки
   * @private
   */
  _handleVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      // Небольшая задержка перед возобновлением
      setTimeout(() => this.resume(), 100);
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    this._clearFade();
    
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    
    this.isPlaying = false;
    this.sounds = {};
  }
}
