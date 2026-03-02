/**
 * PROFILE MODULE
 *
 * Вкладка «Профиль» в личном кабинете (/account?tab=profile).
 * Редактирование: username, displayName, bio, аватар.
 *
 * - Живая валидация username через GET /api/profile/check-username/:username
 * - Загрузка аватара через POST /api/upload/image → PUT /api/profile { avatarUrl }
 * - Превью профиля (как будет выглядеть шапка на полке)
 */

import { BaseModule } from './BaseModule.js';

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const CHECK_DEBOUNCE = 400; // мс

export class ProfileModule extends BaseModule {
  constructor(app) {
    super(app);
    this._api = app._api;
    this._currentUser = app._currentUser;
    this._checkTimer = null;
    this._lastCheckedUsername = null;
    /** Pending avatar URL (не сохранённый на сервер). null = удалить, undefined = без изменений */
    this._pendingAvatarUrl = undefined;
  }

  cacheDOM() {
    const c = this.app.container;
    this._usernameInput = c.querySelector('#profileUsername');
    this._displayNameInput = c.querySelector('#profileDisplayName');
    this._bioInput = c.querySelector('#profileBio');
    this._bioCharCount = c.querySelector('#bioCharCount');
    this._usernameHint = c.querySelector('#usernameHint');
    this._usernameValidation = c.querySelector('#usernameValidation');
    this._avatarPreview = c.querySelector('#profileAvatarPreview');
    this._avatarInput = c.querySelector('#profileAvatarInput');
    this._avatarRemoveBtn = c.querySelector('#profileAvatarRemove');
    this._saveBtn = c.querySelector('#saveProfile');
    this._previewContainer = c.querySelector('#profilePreview');
  }

  bindEvents() {
    // Username — live validation
    this._usernameInput.addEventListener('input', () => this._onUsernameInput());

    // Bio — счётчик символов
    this._bioInput.addEventListener('input', () => {
      this._bioCharCount.textContent = this._bioInput.value.length;
    });

    // Аватар — загрузка
    this._avatarInput.addEventListener('change', (e) => this._onAvatarChange(e));
    this._avatarRemoveBtn.addEventListener('click', () => this._removeAvatar());

    // Сохранить
    this._saveBtn.addEventListener('click', () => this._save());
  }

  render() {
    if (!this._currentUser) return;
    this._pendingAvatarUrl = undefined;

    const { username, displayName, bio, avatarUrl } = this._currentUser;

    // Заполнить поля
    this._usernameInput.value = username || '';
    this._displayNameInput.value = displayName || '';
    this._bioInput.value = bio || '';
    this._bioCharCount.textContent = (bio || '').length;

    // Аватар
    this._renderAvatarPreview(avatarUrl);

    // Превью профиля
    this._renderProfilePreview();

    // Скрыть валидацию
    this._usernameValidation.hidden = true;
  }

  destroy() {
    clearTimeout(this._checkTimer);
  }

  // ═══════════════════════════════════════════
  // Username validation
  // ═══════════════════════════════════════════

  _onUsernameInput() {
    const value = this._usernameInput.value.trim().toLowerCase();
    this._usernameInput.value = value;

    // Обновить превью
    this._renderProfilePreview();

    // Базовая валидация формата
    if (!value) {
      this._showUsernameStatus('', 'neutral');
      return;
    }

    if (!USERNAME_RE.test(value)) {
      this._showUsernameStatus('Некорректный формат', 'error');
      return;
    }

    // Если совпадает с текущим username — ОК
    if (value === this._currentUser.username) {
      this._showUsernameStatus('Ваш текущий username', 'success');
      return;
    }

    // Debounced проверка на сервере
    this._showUsernameStatus('Проверяю...', 'neutral');
    clearTimeout(this._checkTimer);
    this._checkTimer = setTimeout(() => this._checkUsername(value), CHECK_DEBOUNCE);
  }

  async _checkUsername(username) {
    if (this._lastCheckedUsername === username) return;
    this._lastCheckedUsername = username;

    try {
      const result = await this._api.checkUsername(username);
      // Проверить, что инпут не изменился пока шёл запрос
      if (this._usernameInput.value.trim().toLowerCase() !== username) return;

      if (result.available) {
        this._showUsernameStatus('Доступен', 'success');
      } else {
        this._showUsernameStatus('Уже занят', 'error');
      }
    } catch {
      this._showUsernameStatus('Ошибка проверки', 'error');
    }
  }

  /**
   * @param {string} text
   * @param {'success'|'error'|'neutral'} type
   */
  _showUsernameStatus(text, type) {
    if (!text) {
      this._usernameValidation.hidden = true;
      return;
    }
    this._usernameValidation.hidden = false;
    this._usernameValidation.textContent = text;
    this._usernameValidation.className = `form-validation form-validation--${type}`;
  }

  // ═══════════════════════════════════════════
  // Аватар
  // ═══════════════════════════════════════════

  async _onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!this._validateFile(file, {
      maxSize: 2 * 1024 * 1024,
      mimePrefix: 'image/',
      inputEl: this._avatarInput,
    })) return;

    try {
      const result = await this._api.uploadImage(file);
      this._pendingAvatarUrl = result.url;
      this._renderAvatarPreview(result.url);
      this._renderProfilePreview();
    } catch {
      this._showToast('Ошибка загрузки аватара', 'error');
    }

    this._avatarInput.value = '';
  }

  _removeAvatar() {
    this._pendingAvatarUrl = null;
    this._renderAvatarPreview(null);
    this._renderProfilePreview();
  }

  _renderAvatarPreview(avatarUrl) {
    if (avatarUrl) {
      this._avatarPreview.innerHTML = `<img src="${this._escapeHtml(avatarUrl)}" alt="Аватар" class="profile-avatar-img">`;
      this._avatarRemoveBtn.hidden = false;
    } else {
      const name = this._displayNameInput?.value || this._currentUser?.displayName || this._currentUser?.username || '?';
      const initial = name.charAt(0).toUpperCase();
      const hue = this._hashToHue(this._currentUser?.username || name);
      this._avatarPreview.innerHTML = `
        <div class="profile-avatar-placeholder" style="background: hsl(${hue}, 45%, 45%)">
          <span>${this._escapeHtml(initial)}</span>
        </div>`;
      this._avatarRemoveBtn.hidden = true;
    }
  }

  // ═══════════════════════════════════════════
  // Превью профиля
  // ═══════════════════════════════════════════

  _renderProfilePreview() {
    if (!this._previewContainer) return;

    const username = this._usernameInput?.value || this._currentUser?.username || '';
    const displayName = this._displayNameInput?.value || this._currentUser?.displayName || username;
    const bio = this._bioInput?.value || '';
    const avatarUrl = this._pendingAvatarUrl !== undefined ? this._pendingAvatarUrl : this._currentUser?.avatarUrl;
    const name = displayName || username || '?';
    const initial = name.charAt(0).toUpperCase();
    const hue = this._hashToHue(username || name);

    const avatarHtml = avatarUrl
      ? `<img src="${this._escapeHtml(avatarUrl)}" alt="" class="profile-header-avatar-img">`
      : `<span class="profile-header-initial">${this._escapeHtml(initial)}</span>`;

    this._previewContainer.innerHTML = `
      <div class="profile-header profile-header--preview">
        <div class="profile-header-avatar" style="background: ${avatarUrl ? 'transparent' : `hsl(${hue}, 45%, 45%)`}">
          ${avatarHtml}
        </div>
        <div class="profile-header-info">
          <h2 class="profile-header-name">${this._escapeHtml(name)}</h2>
          ${username ? `<span class="profile-header-username">@${this._escapeHtml(username)}</span>` : ''}
          ${bio ? `<p class="profile-header-bio">${this._escapeHtml(bio)}</p>` : ''}
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  // Сохранение
  // ═══════════════════════════════════════════

  async _save() {
    const username = this._usernameInput.value.trim().toLowerCase();
    const displayName = this._displayNameInput.value.trim() || null;
    const bio = this._bioInput.value.trim() || null;
    const avatarUrl = this._pendingAvatarUrl !== undefined
      ? this._pendingAvatarUrl
      : (this._currentUser.avatarUrl || null);

    // Валидация username
    if (username && !USERNAME_RE.test(username)) {
      this._showToast('Некорректный формат username', 'error');
      return;
    }

    const data = {};
    if (username) data.username = username;
    if (displayName !== undefined) data.displayName = displayName;
    if (bio !== undefined) data.bio = bio;
    data.avatarUrl = avatarUrl;

    try {
      const updated = await this._api.updateProfile(data);

      // Обновить локальное состояние только после успешного сохранения
      Object.assign(this._currentUser, {
        username: updated.username ?? this._currentUser.username,
        displayName: updated.displayName ?? null,
        bio: updated.bio ?? null,
        avatarUrl: updated.avatarUrl ?? null,
      });

      // Сбросить pending — теперь _currentUser актуален
      this._pendingAvatarUrl = undefined;

      this._showToast('Профиль сохранён', 'success');
      this._renderProfilePreview();
    } catch (err) {
      const message = err.message || 'Ошибка сохранения профиля';
      this._showToast(message, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Утилиты
  // ═══════════════════════════════════════════

  _hashToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }
}
