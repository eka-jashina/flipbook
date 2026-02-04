/**
 * PWA INSTALL PROMPT
 *
 * Показывает баннер с предложением установить приложение.
 * Автоматически обрабатывает событие beforeinstallprompt.
 *
 * Особенности:
 * - Не показывается если приложение уже установлено (standalone)
 * - Не показывается если пользователь уже отклонил предложение
 * - Показывается через 30 секунд после первого посещения
 * - Можно повторно вызвать из настроек
 */

const STORAGE_KEY = 'flipbook_install_dismissed';
const DELAY_MS = 30000; // 30 секунд перед показом

export class InstallPrompt {
  constructor() {
    /** @type {BeforeInstallPromptEvent|null} */
    this._deferredPrompt = null;
    /** @type {HTMLElement|null} */
    this._banner = null;
    /** @type {number|null} */
    this._showTimeout = null;
    /** @type {Function[]} */
    this._listeners = [];

    this._boundOnBeforeInstall = this._onBeforeInstall.bind(this);
    this._boundOnAppInstalled = this._onAppInstalled.bind(this);

    this._init();
  }

  /**
   * Инициализация
   * @private
   */
  _init() {
    // Не показываем если уже в standalone режиме (установлено как PWA)
    if (this._isStandalone()) {
      return;
    }

    // Слушаем события браузера
    window.addEventListener('beforeinstallprompt', this._boundOnBeforeInstall);
    window.addEventListener('appinstalled', this._boundOnAppInstalled);
  }

  /**
   * Проверка standalone режима
   * @private
   * @returns {boolean}
   */
  _isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  /**
   * Проверка, отклонял ли пользователь установку
   * @private
   * @returns {boolean}
   */
  _isDismissed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Сохранить отклонение
   * @private
   */
  _setDismissed() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Игнорируем ошибки localStorage
    }
  }

  /**
   * Обработчик события beforeinstallprompt
   * @private
   * @param {BeforeInstallPromptEvent} e
   */
  _onBeforeInstall(e) {
    // Отменяем стандартный промпт браузера
    e.preventDefault();

    // Сохраняем событие для последующего использования
    this._deferredPrompt = e;

    // Уведомляем слушателей о доступности установки
    this._notifyListeners('available');

    // Если пользователь не отклонял - показываем баннер через таймаут
    if (!this._isDismissed()) {
      this._scheduleShow();
    }
  }

  /**
   * Обработчик успешной установки
   * @private
   */
  _onAppInstalled() {
    this._deferredPrompt = null;
    this.hide();
    this._notifyListeners('installed');
  }

  /**
   * Запланировать показ баннера
   * @private
   */
  _scheduleShow() {
    if (this._showTimeout) {
      clearTimeout(this._showTimeout);
    }

    this._showTimeout = setTimeout(() => {
      this.show();
    }, DELAY_MS);
  }

  /**
   * Уведомить слушателей
   * @private
   * @param {'available'|'installed'|'dismissed'} event
   */
  _notifyListeners(event) {
    this._listeners.forEach(fn => {
      try {
        fn(event);
      } catch (e) {
        console.error('InstallPrompt listener error:', e);
      }
    });
  }

  /**
   * Создать DOM баннера
   * @private
   * @returns {HTMLElement}
   */
  _createBanner() {
    const banner = document.createElement('div');
    banner.className = 'install-prompt';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'install-prompt-title');

    banner.innerHTML = `
      <div class="install-prompt__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32">
          <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2l4-4h-3V7h-2v6H8l4 4z"/>
        </svg>
      </div>
      <div class="install-prompt__content">
        <div class="install-prompt__title" id="install-prompt-title">Установите приложение</div>
        <div class="install-prompt__text">Читайте книгу офлайн с удобным доступом</div>
      </div>
      <div class="install-prompt__actions">
        <button class="install-prompt__btn install-prompt__btn--dismiss" type="button" aria-label="Не сейчас">
          Позже
        </button>
        <button class="install-prompt__btn install-prompt__btn--install" type="button">
          Установить
        </button>
      </div>
      <button class="install-prompt__close" type="button" aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    // Обработчики кнопок
    const installBtn = banner.querySelector('.install-prompt__btn--install');
    const dismissBtn = banner.querySelector('.install-prompt__btn--dismiss');
    const closeBtn = banner.querySelector('.install-prompt__close');

    installBtn.addEventListener('click', () => this.install());
    dismissBtn.addEventListener('click', () => this.dismiss());
    closeBtn.addEventListener('click', () => this.dismiss());

    return banner;
  }

  /**
   * Показать баннер
   */
  show() {
    // Не показываем если нет промпта или уже показан
    if (!this._deferredPrompt || this._banner) {
      return;
    }

    this._banner = this._createBanner();
    document.body.appendChild(this._banner);

    // Анимация появления
    requestAnimationFrame(() => {
      this._banner?.classList.add('install-prompt--visible');
    });
  }

  /**
   * Скрыть баннер
   */
  hide() {
    if (!this._banner) return;

    this._banner.classList.remove('install-prompt--visible');

    // Удаляем после анимации
    setTimeout(() => {
      this._banner?.remove();
      this._banner = null;
    }, 300);
  }

  /**
   * Отклонить предложение
   */
  dismiss() {
    this._setDismissed();
    this.hide();
    this._notifyListeners('dismissed');
  }

  /**
   * Запустить установку
   */
  async install() {
    if (!this._deferredPrompt) {
      return false;
    }

    // Показываем нативный промпт
    this._deferredPrompt.prompt();

    // Ждём ответа пользователя
    const { outcome } = await this._deferredPrompt.userChoice;

    // Очищаем промпт (его можно использовать только один раз)
    this._deferredPrompt = null;
    this.hide();

    return outcome === 'accepted';
  }

  /**
   * Доступна ли установка
   * @returns {boolean}
   */
  get canInstall() {
    return this._deferredPrompt !== null && !this._isStandalone();
  }

  /**
   * Подписка на события
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onStateChange(callback) {
    this._listeners.push(callback);

    // Сразу уведомляем если установка уже доступна
    if (this._deferredPrompt) {
      callback('available');
    }

    return () => {
      const idx = this._listeners.indexOf(callback);
      if (idx !== -1) {
        this._listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Сбросить отклонение (для повторного показа из настроек)
   */
  resetDismissed() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Игнорируем
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this._showTimeout) {
      clearTimeout(this._showTimeout);
    }

    window.removeEventListener('beforeinstallprompt', this._boundOnBeforeInstall);
    window.removeEventListener('appinstalled', this._boundOnAppInstalled);

    this.hide();
    this._listeners = [];
  }
}

// Экспорт синглтона для удобства
export const installPrompt = new InstallPrompt();
