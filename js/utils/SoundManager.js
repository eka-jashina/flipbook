/**
 * SOUND MANAGER
 * Управление звуковыми эффектами книги.
 */

export class SoundManager {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.volume = options.volume ?? 0.3;
    this.sounds = new Map();
    this.preloadQueue = [];
  }

  /**
   * Зарегистрировать звук
   * @param {string} name - Имя звука
   * @param {string} url - URL файла
   * @param {Object} options - Опции
   */
  register(name, url, options = {}) {
    const sound = {
      url,
      audio: null,
      loaded: false,
      volume: options.volume ?? this.volume,
      poolSize: options.poolSize ?? 3, // Пул для одновременного воспроизведения
      pool: [],
      currentIndex: 0,
    };

    this.sounds.set(name, sound);
    
    if (options.preload) {
      this.preloadQueue.push(name);
    }

    return this;
  }

  /**
   * Предзагрузить звуки
   * @returns {Promise<void>}
   */
  async preload() {
    const promises = this.preloadQueue.map(name => this._loadSound(name));
    await Promise.allSettled(promises);
  }

  /**
   * Загрузить конкретный звук
   * @private
   */
  async _loadSound(name) {
    const sound = this.sounds.get(name);
    if (!sound || sound.loaded) return;

    try {
      // Создаем пул аудио элементов
      for (let i = 0; i < sound.poolSize; i++) {
        const audio = new Audio(sound.url);
        audio.volume = sound.volume;
        audio.preload = 'auto';
        
        // Ждем загрузки первого элемента
        if (i === 0) {
          await new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.addEventListener('error', reject, { once: true });
          });
        }
        
        sound.pool.push(audio);
      }
      
      sound.loaded = true;
    } catch (error) {
      console.warn(`Failed to load sound "${name}":`, error);
    }
  }

  /**
   * Воспроизвести звук
   * @param {string} name - Имя звука
   * @param {Object} options - Опции воспроизведения
   */
  async play(name, options = {}) {
    if (!this.enabled) return;

    const sound = this.sounds.get(name);
    if (!sound) {
      console.warn(`Sound "${name}" not registered`);
      return;
    }

    // Загружаем если еще не загружен
    if (!sound.loaded) {
      await this._loadSound(name);
    }

    if (!sound.loaded || !sound.pool.length) return;

    try {
      // Берем следующий аудио элемент из пула
      const audio = sound.pool[sound.currentIndex];
      sound.currentIndex = (sound.currentIndex + 1) % sound.pool.length;

      // Применяем опции
      if (options.volume !== undefined) {
        audio.volume = options.volume;
      }
      
      if (options.playbackRate !== undefined) {
        audio.playbackRate = options.playbackRate;
      }

      // Останавливаем если уже играет и начинаем заново
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Игнорируем ошибки autoplay policy
          if (error.name !== 'NotAllowedError') {
            console.warn(`Failed to play sound "${name}":`, error);
          }
        });
      }
    } catch (error) {
      console.warn(`Error playing sound "${name}":`, error);
    }
  }

  /**
   * Включить/выключить звуки
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Установить громкость
   * @param {number} volume - 0.0 - 1.0
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Обновляем громкость всех загруженных звуков
    for (const sound of this.sounds.values()) {
      if (sound.loaded) {
        sound.pool.forEach(audio => {
          audio.volume = this.volume;
        });
      }
    }
  }

  /**
   * Остановить все звуки
   */
  stopAll() {
    for (const sound of this.sounds.values()) {
      if (sound.loaded) {
        sound.pool.forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });
      }
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.stopAll();
    
    for (const sound of this.sounds.values()) {
      if (sound.loaded) {
        sound.pool.forEach(audio => {
          audio.src = '';
          audio.load();
        });
        sound.pool = [];
      }
    }
    
    this.sounds.clear();
    this.preloadQueue = [];
  }
}
