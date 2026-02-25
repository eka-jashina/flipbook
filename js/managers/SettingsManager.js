/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью.
 *
 * Особенности:
 * - Автоматическое сохранение в localStorage
 * - Слияние defaults с сохранёнными настройками
 * - Предотвращение лишних сохранений при одинаковых значениях
 * - Валидация значений перед сохранением (защита от невалидных данных в localStorage)
 * - Фаза 3: debounced sync прогресса на сервер (PUT /api/books/:bookId/progress)
 * - navigator.sendBeacon() для финальной синхронизации при закрытии вкладки
 */

import { sanitizeSettings, sanitizeSetting } from '../utils/SettingsValidator.js';

/** Задержка перед отправкой на сервер (мс) */
const SYNC_DEBOUNCE = 5000;

export class SettingsManager {
  /**
   * @param {StorageManager} storage - Менеджер хранилища
   * @param {Object} defaults - Значения по умолчанию
   * @param {Object} [options]
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient] - API клиент (Фаза 3)
   * @param {string} [options.bookId] - ID книги для sync прогресса
   */
  constructor(storage, defaults = {}, { apiClient, bookId } = {}) {
    this.storage = storage;
    this._defaults = defaults;
    this._api = apiClient || null;
    this._bookId = bookId || null;
    this._syncTimer = null;
    this._dirty = false;
    this._boundBeforeUnload = this._onBeforeUnload.bind(this);

    // Сохранённые настройки перезаписывают defaults,
    // затем санитизируются для защиты от повреждённых данных в localStorage
    const merged = { ...defaults, ...storage.load() };
    this.settings = sanitizeSettings(merged, defaults);

    // Привязываем sendBeacon при закрытии вкладки
    if (this._api && this._bookId) {
      window.addEventListener('beforeunload', this._boundBeforeUnload);
    }
  }

  /**
   * Инициализировать настройки из серверного прогресса.
   * Вызывается после создания, когда доступны данные с сервера.
   *
   * @param {Object} serverProgress - Прогресс чтения с сервера
   */
  applyServerProgress(serverProgress) {
    if (!serverProgress) return;

    // Серверный прогресс перезаписывает локальные настройки
    const merged = { ...this._defaults, ...serverProgress };
    this.settings = sanitizeSettings(merged, this._defaults);

    // Сохранить в localStorage для быстрого доступа
    this.storage.save(this.settings);
  }

  /**
   * Получить значение настройки
   * @param {string} key - Ключ настройки
   * @returns {*} Значение настройки
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Установить значение настройки
   * Автоматически валидирует и сохраняет в storage
   * @param {string} key - Ключ настройки
   * @param {*} value - Новое значение
   */
  set(key, value) {
    // Санитизировать значение перед сохранением
    const defaultValue = this._defaults ? this._defaults[key] : undefined;
    const sanitized = sanitizeSetting(key, value, defaultValue);

    const oldValue = this.settings[key];
    // Не делаем ничего если значение не изменилось
    if (oldValue === sanitized) return;

    this.settings[key] = sanitized;
    this.storage.save({ [key]: sanitized });

    // Фаза 3: debounced sync на сервер
    if (this._api && this._bookId) {
      this._dirty = true;
      this._scheduleSyncToServer();
    }
  }

  /**
   * Запланировать отправку прогресса на сервер
   * @private
   */
  _scheduleSyncToServer() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
    }
    this._syncTimer = setTimeout(() => {
      this._syncToServer();
    }, SYNC_DEBOUNCE);
  }

  /**
   * Отправить текущий прогресс на сервер
   * @private
   */
  async _syncToServer() {
    if (!this._dirty || !this._api || !this._bookId) return;

    const data = {
      page: this.settings.page ?? 0,
      font: this.settings.font || 'georgia',
      fontSize: this.settings.fontSize || 18,
      theme: this.settings.theme || 'light',
      soundEnabled: this.settings.soundEnabled ?? true,
      soundVolume: this.settings.soundVolume ?? 0.3,
      ambientType: this.settings.ambientType || 'none',
      ambientVolume: this.settings.ambientVolume ?? 0.5,
    };

    try {
      await this._api.saveProgress(this._bookId, data);
      this._dirty = false;
    } catch (err) {
      console.warn('SettingsManager: не удалось сохранить прогресс на сервер', err);
      // При ошибке сети — не критично, прогресс сохранён в localStorage.
      // В Фазе 4 добавится sync queue.
    }
  }

  /**
   * Финальная синхронизация при закрытии вкладки через sendBeacon
   * @private
   */
  _onBeforeUnload() {
    if (!this._dirty || !this._bookId) return;

    const data = {
      page: this.settings.page ?? 0,
      font: this.settings.font || 'georgia',
      fontSize: this.settings.fontSize || 18,
      theme: this.settings.theme || 'light',
      soundEnabled: this.settings.soundEnabled ?? true,
      soundVolume: this.settings.soundVolume ?? 0.3,
      ambientType: this.settings.ambientType || 'none',
      ambientVolume: this.settings.ambientVolume ?? 0.5,
    };

    // sendBeacon гарантирует доставку даже при закрытии вкладки
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(`/api/books/${this._bookId}/progress`, blob);
      this._dirty = false;
    } catch {
      // sendBeacon может не поддерживаться — не критично
    }
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    // Финальная синхронизация перед уничтожением
    if (this._dirty && this._api && this._bookId) {
      this._syncToServer().catch(() => {});
    }

    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }

    window.removeEventListener('beforeunload', this._boundBeforeUnload);

    this.storage = null;
    this.settings = null;
    this._defaults = null;
    this._api = null;
    this._bookId = null;
  }
}
