/**
 * Модуль управления звуками
 */
import { BaseModule } from './BaseModule.js';

/** Конфигурация звуковых карточек */
const SOUND_CARDS = [
  { key: 'pageFlip', label: 'Перелистывание', placeholder: 'sounds/page-flip.mp3', defaultHint: 'sounds/page-flip.mp3' },
  { key: 'bookOpen', label: 'Открытие книги', placeholder: 'sounds/cover-flip.mp3', defaultHint: 'sounds/cover-flip.mp3' },
  { key: 'bookClose', label: 'Закрытие книги', placeholder: 'sounds/cover-flip.mp3', defaultHint: 'sounds/cover-flip.mp3' },
];

export class SoundsModule extends BaseModule {
  cacheDOM() {
    // Контейнер для звуковых карточек
    this.soundCardsGrid = document.getElementById('soundCardsGrid');
    this._renderSoundCardsHTML();

    // Кэшируем сгенерированные элементы
    this._fields = {};
    this._uploads = {};
    this._hints = {};
    for (const { key } of SOUND_CARDS) {
      this._fields[key] = document.getElementById(`sound-${key}`);
      this._uploads[key] = document.getElementById(`sound-${key}-upload`);
      this._hints[key] = document.getElementById(`sound-${key}-hint`);
    }

    this.saveSoundsBtn = document.getElementById('saveSounds');
    this.resetSoundsBtn = document.getElementById('resetSounds');
  }

  /** Сгенерировать HTML звуковых карточек */
  _renderSoundCardsHTML() {
    this.soundCardsGrid.innerHTML = SOUND_CARDS.map(({ key, label, placeholder, defaultHint }) => `
      <div class="setting-card">
        <label class="setting-label" for="sound-${key}">${label}</label>
        <div class="sound-input-row">
          <input class="form-input" type="text" id="sound-${key}" placeholder="${placeholder}">
          <label class="btn btn-small upload-btn" title="Загрузить файл">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
            <input type="file" id="sound-${key}-upload" accept="audio/*" hidden>
          </label>
        </div>
        <span class="form-hint" id="sound-${key}-hint">Дефолт: ${defaultHint}</span>
      </div>
    `).join('');
  }

  bindEvents() {
    for (const { key } of SOUND_CARDS) {
      this._uploads[key].addEventListener('change', (e) => this._handleSoundUpload(e, key));
    }
    this.saveSoundsBtn.addEventListener('click', () => this._saveSounds());
    this.resetSoundsBtn.addEventListener('click', () => this._resetSounds());
  }

  render() {
    this._renderSounds();
  }

  _renderSounds() {
    const sounds = this.store.getSounds();

    for (const { key, defaultHint } of SOUND_CARDS) {
      const input = this._fields[key];
      const hint = this._hints[key];
      const value = sounds[key] || '';

      if (value.startsWith('data:')) {
        input.value = '';
        hint.textContent = 'Загруженный файл';
      } else {
        input.value = value;
        hint.textContent = `Дефолт: ${defaultHint}`;
      }
    }
  }

  _handleSoundUpload(e, key) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.store.updateSounds({ [key]: reader.result });
      this._renderSounds();
      this._renderJsonPreview();
      this._showToast('Звук загружен');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _saveSounds() {
    const update = {};
    for (const { key } of SOUND_CARDS) {
      const value = this._fields[key].value.trim();
      if (value) update[key] = value;
    }

    const current = this.store.getSounds();
    this.store.updateSounds({
      pageFlip: update.pageFlip || current.pageFlip,
      bookOpen: update.bookOpen || current.bookOpen,
      bookClose: update.bookClose || current.bookClose,
    });

    this._renderSounds();
    this._renderJsonPreview();
    this._showToast('Звуки сохранены');
  }

  _resetSounds() {
    this.store.updateSounds({
      pageFlip: 'sounds/page-flip.mp3',
      bookOpen: 'sounds/cover-flip.mp3',
      bookClose: 'sounds/cover-flip.mp3',
    });

    this._renderSounds();
    this._renderJsonPreview();
    this._showToast('Звуки сброшены');
  }
}
