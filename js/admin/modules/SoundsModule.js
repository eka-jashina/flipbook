/**
 * Модуль управления звуками
 */
import { BaseModule } from './BaseModule.js';

export class SoundsModule extends BaseModule {
  cacheDOM() {
    this.soundPageFlip = document.getElementById('soundPageFlip');
    this.soundBookOpen = document.getElementById('soundBookOpen');
    this.soundBookClose = document.getElementById('soundBookClose');
    this.soundPageFlipUpload = document.getElementById('soundPageFlipUpload');
    this.soundBookOpenUpload = document.getElementById('soundBookOpenUpload');
    this.soundBookCloseUpload = document.getElementById('soundBookCloseUpload');
    this.soundPageFlipHint = document.getElementById('soundPageFlipHint');
    this.soundBookOpenHint = document.getElementById('soundBookOpenHint');
    this.soundBookCloseHint = document.getElementById('soundBookCloseHint');
    this.saveSoundsBtn = document.getElementById('saveSounds');
    this.resetSoundsBtn = document.getElementById('resetSounds');
  }

  bindEvents() {
    this.soundPageFlipUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'pageFlip'));
    this.soundBookOpenUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'bookOpen'));
    this.soundBookCloseUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'bookClose'));
    this.saveSoundsBtn.addEventListener('click', () => this._saveSounds());
    this.resetSoundsBtn.addEventListener('click', () => this._resetSounds());
  }

  render() {
    this._renderSounds();
  }

  _renderSounds() {
    const sounds = this.store.getSounds();
    const fields = { pageFlip: this.soundPageFlip, bookOpen: this.soundBookOpen, bookClose: this.soundBookClose };
    const hints = { pageFlip: this.soundPageFlipHint, bookOpen: this.soundBookOpenHint, bookClose: this.soundBookCloseHint };

    for (const [key, input] of Object.entries(fields)) {
      const value = sounds[key] || '';
      if (value.startsWith('data:')) {
        input.value = '';
        hints[key].textContent = 'Загруженный файл';
      } else {
        input.value = value;
        hints[key].textContent = `Дефолт: ${key === 'pageFlip' ? 'sounds/page-flip.mp3' : 'sounds/cover-flip.mp3'}`;
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
    if (this.soundPageFlip.value.trim()) update.pageFlip = this.soundPageFlip.value.trim();
    if (this.soundBookOpen.value.trim()) update.bookOpen = this.soundBookOpen.value.trim();
    if (this.soundBookClose.value.trim()) update.bookClose = this.soundBookClose.value.trim();

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
