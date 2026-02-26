/**
 * AUTH MODAL
 *
 * Модальное окно аутентификации — логин/регистрация (email + password + Google OAuth).
 * Показывается поверх bookshelf, когда сервер отвечает 401.
 *
 * Поток: GET /api/auth/me → 401 → модалка → 200 → bookshelf с книгами.
 */

export class AuthModal {
  /**
   * @param {Object} options
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {Function} options.onAuth - Колбэк после успешной авторизации (user)
   */
  constructor({ apiClient, onAuth }) {
    this._api = apiClient;
    this._onAuth = onAuth;
    this._mode = 'login'; // 'login' | 'register'
    this._el = null;
    this._boundKeydown = this._onKeydown.bind(this);
  }

  /**
   * Показать модалку аутентификации
   */
  show() {
    if (this._el) return;
    this._mode = 'login';
    this._render();
    document.addEventListener('keydown', this._boundKeydown);
  }

  /**
   * Скрыть модалку
   */
  hide() {
    if (!this._el) return;
    document.removeEventListener('keydown', this._boundKeydown);
    this._el.remove();
    this._el = null;
  }

  /**
   * Полная очистка
   */
  destroy() {
    this.hide();
  }

  // ═══════════════════════════════════════════
  // Рендеринг
  // ═══════════════════════════════════════════

  _render() {
    if (this._el) this._el.remove();

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = this._getHTML();
    document.body.appendChild(overlay);
    this._el = overlay;

    this._bindFormEvents();
    this._focusFirst();
  }

  _getHTML() {
    const isLogin = this._mode === 'login';
    return `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-label="${isLogin ? 'Вход' : 'Регистрация'}">
        <div class="auth-modal-header">
          <h2 class="auth-modal-title">${isLogin ? 'Вход' : 'Регистрация'}</h2>
          <p class="auth-modal-subtitle">${isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}</p>
        </div>
        <form class="auth-form" novalidate>
          ${!isLogin ? `
          <div class="auth-field">
            <label for="auth-name" class="auth-label">Имя</label>
            <input type="text" id="auth-name" class="auth-input" placeholder="Ваше имя" autocomplete="name">
          </div>` : ''}
          <div class="auth-field">
            <label for="auth-email" class="auth-label">Email</label>
            <input type="email" id="auth-email" class="auth-input" placeholder="email@example.com" autocomplete="email" required>
          </div>
          <div class="auth-field">
            <label for="auth-password" class="auth-label">Пароль</label>
            <input type="password" id="auth-password" class="auth-input" placeholder="${isLogin ? 'Ваш пароль' : 'Минимум 8 символов'}" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8">
          </div>
          <div class="auth-error" id="auth-error" hidden></div>
          <button type="submit" class="auth-submit">${isLogin ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
        <div class="auth-divider"><span>или</span></div>
        <a href="/api/auth/google" class="auth-google-btn">
          <svg class="auth-google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Войти через Google
        </a>
        <div class="auth-switch">
          ${isLogin
            ? 'Нет аккаунта? <button type="button" class="auth-switch-btn" data-action="switch">Зарегистрироваться</button>'
            : 'Уже есть аккаунт? <button type="button" class="auth-switch-btn" data-action="switch">Войти</button>'}
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  // Обработка событий
  // ═══════════════════════════════════════════

  _bindFormEvents() {
    const form = this._el.querySelector('.auth-form');
    const switchBtn = this._el.querySelector('[data-action="switch"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    switchBtn.addEventListener('click', () => {
      this._mode = this._mode === 'login' ? 'register' : 'login';
      this._render();
    });
  }

  async _handleSubmit() {
    const email = this._el.querySelector('#auth-email').value.trim();
    const password = this._el.querySelector('#auth-password').value;
    const errorEl = this._el.querySelector('#auth-error');
    const submitBtn = this._el.querySelector('.auth-submit');

    // Клиентская валидация
    if (!email) {
      this._showError(errorEl, 'Введите email');
      return;
    }
    if (password.length < 8) {
      this._showError(errorEl, 'Пароль должен содержать минимум 8 символов');
      return;
    }

    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = this._mode === 'login' ? 'Вход...' : 'Регистрация...';
    errorEl.hidden = true;

    try {
      let user;
      if (this._mode === 'login') {
        user = await this._api.login(email, password);
      } else {
        const name = this._el.querySelector('#auth-name')?.value.trim() || null;
        user = await this._api.register(email, password, name);
      }
      this.hide();
      if (this._onAuth) this._onAuth(user);
    } catch (err) {
      this._showError(errorEl, err.message || 'Произошла ошибка');
      submitBtn.disabled = false;
      submitBtn.textContent = this._mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    }
  }

  _showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }

  _focusFirst() {
    const firstInput = this._el.querySelector('.auth-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  _onKeydown(e) {
    if (e.key === 'Escape') {
      // Не закрываем модалку по Escape — авторизация обязательна
    }
  }
}
