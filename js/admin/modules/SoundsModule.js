/**
 * Модуль управления звуками
 */
import { BaseModule } from './BaseModule.js';
import { readFileAsDataURL } from './adminHelpers.js';
import { t } from '@i18n';

/** Конфигурация звуковых карточек */
function getSoundCards() {
  return [
    { key: 'pageFlip', label: t('admin.sounds.pageFlip'), placeholder: 'sounds/page-flip.mp3', defaultHint: 'sounds/page-flip.mp3' },
    { key: 'bookOpen', label: t('admin.sounds.bookOpen'), placeholder: 'sounds/cover-flip.mp3', defaultHint: 'sounds/cover-flip.mp3' },
    { key: 'bookClose', label: t('admin.sounds.bookClose'), placeholder: 'sounds/cover-flip.mp3', defaultHint: 'sounds/cover-flip.mp3' },
  ];
}

export class SoundsModule extends BaseModule {
  cacheDOM() {
    // Контейнер для звуковых карточек
    this.soundCardsGrid = document.getElementById('soundCardsGrid');
    this._renderSoundCardsHTML();

    // Кэшируем сгенерированные элементы
    this._fields = {};
    this._uploads = {};
    this._hints = {};
    for (const { key } of getSoundCards()) {
      this._fields[key] = document.getElementById(`sound-${key}`);
      this._uploads[key] = document.getElementById(`sound-${key}-upload`);
      this._hints[key] = document.getElementById(`sound-${key}-hint`);
    }

    this.saveSoundsBtn = document.getElementById('saveSounds');
    this.resetSoundsBtn = document.getElementById('resetSounds');
  }

  /** Сгенерировать HTML звуковых карточек */
  _renderSoundCardsHTML() {
    this.soundCardsGrid.innerHTML = getSoundCards().map(({ key, label, placeholder, defaultHint }) => `
      <div class="setting-card">
        <label class="setting-label" for="sound-${key}">${label}</label>
        <div class="sound-input-row">
          <input class="form-input" type="text" id="sound-${key}" placeholder="${placeholder}">
          <label class="btn btn-small upload-btn" title="${t('admin.sounds.uploadFile')}">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
            <input type="file" id="sound-${key}-upload" accept="audio/*" hidden>
          </label>
        </div>
        <span class="form-hint" id="sound-${key}-hint">Дефолт: ${defaultHint}</span>
      </div>
    `).join('');
  }

  bindEvents() {
    for (const { key } of getSoundCards()) {
      this._uploads[key].addEventListener('change', (e) => this._handleSoundUpload(e, key));
    }
    this.saveSoundsBtn.addEventListener('click', () => this._saveSounds());
    this.resetSoundsBtn.addEventListener('click', () => this._resetSounds());
  }

  async render() {
    await this._renderSounds();
  }

  async _renderSounds() {
    const sounds = await this.store.getSounds();

    for (const { key, defaultHint } of getSoundCards()) {
      const input = this._fields[key];
      const hint = this._hints[key];
      const value = sounds[key] || '';

      if (value.startsWith('data:')) {
        input.value = '';
        hint.textContent = t('admin.sounds.uploadedHint');
      } else {
        input.value = value;
        hint.textContent = t('admin.sounds.defaultHint', { path: defaultHint });
      }
    }
  }

  async _handleSoundUpload(e, key) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

    const dataUrl = await readFileAsDataURL(file);
    this.store.updateSounds({ [key]: dataUrl });
    this._renderSounds();
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.loaded'));
    e.target.value = '';
  }

  async _saveSounds() {
    const update = {};
    for (const { key } of getSoundCards()) {
      const value = this._fields[key].value.trim();
      if (value) update[key] = value;
    }

    const current = await this.store.getSounds();
    this.store.updateSounds({
      pageFlip: update.pageFlip || current.pageFlip,
      bookOpen: update.bookOpen || current.bookOpen,
      bookClose: update.bookClose || current.bookClose,
    });

    this._renderSounds();
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.saved'));
  }

  _resetSounds() {
    this.store.updateSounds({
      pageFlip: 'sounds/page-flip.mp3',
      bookOpen: 'sounds/cover-flip.mp3',
      bookClose: 'sounds/cover-flip.mp3',
    });

    this._renderSounds();
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.reset'));
  }
}
