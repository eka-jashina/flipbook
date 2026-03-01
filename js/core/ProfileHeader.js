/**
 * PROFILE HEADER
 *
 * Компонент шапки профиля — аватар (инициалы), имя, bio.
 * Используется на публичном шкафу (/:username) и в личном кабинете (/account).
 *
 * В режиме хозяина показывает кнопку «Редактировать профиль».
 */

export class ProfileHeader {
  /**
   * @param {Object} options
   * @param {Object} options.user - Данные пользователя { username, displayName, bio }
   * @param {boolean} options.isOwner - Это хозяин профиля?
   * @param {Function} [options.onEditProfile] - Колбэк при клике «Редактировать профиль»
   */
  constructor({ user, isOwner, onEditProfile }) {
    this._user = user;
    this._isOwner = isOwner;
    this._onEditProfile = onEditProfile;
    this._el = null;
  }

  /**
   * Отрендерить шапку в контейнер
   * @param {HTMLElement} container
   */
  render(container) {
    this.destroy();

    const el = document.createElement('div');
    el.className = 'profile-header';
    el.innerHTML = this._getHTML();
    container.prepend(el);
    this._el = el;

    if (this._isOwner) {
      const editBtn = el.querySelector('.profile-header-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          if (this._onEditProfile) this._onEditProfile();
        });
      }
    }
  }

  /**
   * Очистка
   */
  destroy() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════

  _getHTML() {
    const { username, displayName, bio } = this._user;
    const name = displayName || username || '?';
    const initial = name.charAt(0).toUpperCase();
    const hue = this._hashToHue(username || name);

    return `
      <div class="profile-header-avatar" style="background: hsl(${hue}, 45%, 45%)">
        <span class="profile-header-initial">${this._escapeHtml(initial)}</span>
      </div>
      <div class="profile-header-info">
        <h2 class="profile-header-name">${this._escapeHtml(name)}</h2>
        ${username ? `<span class="profile-header-username">@${this._escapeHtml(username)}</span>` : ''}
        ${bio ? `<p class="profile-header-bio">${this._escapeHtml(bio)}</p>` : ''}
      </div>
      ${this._isOwner ? `
        <button type="button" class="profile-header-edit">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          Редактировать профиль
        </button>` : ''}
    `;
  }

  /**
   * Детерминированный hue из строки (для цвета аватара)
   * @param {string} str
   * @returns {number} 0-360
   */
  _hashToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
