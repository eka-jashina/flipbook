/**
 * ACCOUNT PUBLISH TAB
 *
 * Логика вкладки «Публикация» в AccountScreen.
 * Управляет видимостью книги (draft/published), описанием и ссылкой для шаринга.
 */

import { trackBookPublished } from '../utils/Analytics.js';

export class AccountPublishTab {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Контейнер AccountScreen
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {Object} options.store - AdminConfigStore или ServerAdminConfigStore
   * @param {(message: string, type?: string) => void} options.showToast
   */
  constructor({ container, apiClient, store, showToast }) {
    this._api = apiClient;
    this._store = store;
    this._showToast = showToast;

    this._publishVisibility = container.querySelector('#publishVisibility');
    this._bookDescription = container.querySelector('#bookDescription');
    this._descCharCount = container.querySelector('#descCharCount');
    this._shareSection = container.querySelector('#shareSection');
    this._shareLink = container.querySelector('#shareLink');
    this._copyShareLinkBtn = container.querySelector('#copyShareLink');
    this._savePublishBtn = container.querySelector('#savePublish');
  }

  bindEvents() {
    this._bookDescription.addEventListener('input', () => {
      this._descCharCount.textContent = this._bookDescription.value.length;
    });

    this._copyShareLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this._shareLink.value).then(() => {
        this._showToast('Ссылка скопирована', 'success');
      }).catch(() => {
        this._shareLink.select();
        document.execCommand('copy');
        this._showToast('Ссылка скопирована', 'success');
      });
    });

    this._savePublishBtn.addEventListener('click', () => this._save());
  }

  /** Заполнить вкладку данными текущей книги */
  async render() {
    const activeBookId = this._store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    try {
      const book = await this._api.getBook(activeBookId);
      const visibility = book.visibility || 'draft';
      const description = book.description || '';

      const radio = this._publishVisibility.querySelector(`input[value="${visibility}"]`);
      if (radio) radio.checked = true;

      this._bookDescription.value = description;
      this._descCharCount.textContent = description.length;

      this._updateShareLink(visibility, activeBookId);
    } catch (err) {
      console.debug('AccountPublishTab: не удалось загрузить данные книги', err);
    }
  }

  async _save() {
    const activeBookId = this._store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    const selected = this._publishVisibility.querySelector('input[name="bookVisibility"]:checked');
    const visibility = selected?.value || 'draft';
    const description = this._bookDescription.value.trim();

    try {
      await this._api.updateBook(activeBookId, { visibility, description });
      if (visibility === 'published') {
        trackBookPublished(activeBookId);
      }
      this._showToast('Настройки публикации сохранены', 'success');
      this._updateShareLink(visibility, activeBookId);
    } catch (err) {
      this._showToast(err.message || 'Ошибка сохранения', 'error');
    }
  }

  /** @private Обновить ссылку для шаринга */
  _updateShareLink(visibility, bookId) {
    if (visibility !== 'draft') {
      this._shareSection.hidden = false;
      const base = location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      this._shareLink.value = `${base}/book/${bookId}`;
    } else {
      this._shareSection.hidden = true;
    }
  }
}
