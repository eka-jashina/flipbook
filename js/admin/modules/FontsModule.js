/**
 * Модуль управления шрифтами (декоративный + шрифты для чтения)
 */
import { BaseModule } from './BaseModule.js';
import { readFileAsDataURL } from './adminHelpers.js';
import { t } from '@i18n';

const FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf'];
// Reader loads admin config from localStorage; data URL expands file size (~33%),
// so keep uploaded decorative font compact to avoid quota overflow.
const MAX_DECORATIVE_FONT_SIZE = 400 * 1024;

export class FontsModule extends BaseModule {
  constructor(app) {
    super(app);
    this._pendingReadingFontDataUrl = null;
  }

  cacheDOM() {
    // Декоративный шрифт
    this.decorativeFontUpload = document.getElementById('decorativeFontUpload');
    this.decorativeFontSample = document.getElementById('decorativeFontSample');
    this.decorativeFontInfo = document.getElementById('decorativeFontInfo');
    this.decorativeFontName = document.getElementById('decorativeFontName');
    this.decorativeFontRemove = document.getElementById('decorativeFontRemove');

    // Шрифты для чтения
    this.readingFontsList = document.getElementById('readingFontsList');
    this.addReadingFontBtn = document.getElementById('addReadingFont');
    this.readingFontModal = document.getElementById('readingFontModal');
    this.readingFontModalTitle = document.getElementById('readingFontModalTitle');
    this.readingFontForm = document.getElementById('readingFontForm');
    this.cancelReadingFontModal = document.getElementById('cancelReadingFontModal');
    this.readingFontNameInput = document.getElementById('readingFontName');
    this.readingFontFileUpload = document.getElementById('readingFontFileUpload');
    this.readingFontUploadLabel = document.getElementById('readingFontUploadLabel');
    this.readingFontCategory = document.getElementById('readingFontCategory');
  }

  bindEvents() {
    // Декоративный шрифт
    this.decorativeFontUpload.addEventListener('change', (e) => this._handleDecorativeFontUpload(e));
    this.decorativeFontRemove.addEventListener('click', () => this._removeDecorativeFont());

    // Шрифты для чтения
    this.addReadingFontBtn.addEventListener('click', () => this._openReadingFontModal());
    this.cancelReadingFontModal.addEventListener('click', () => this.readingFontModal.close());
    this.readingFontForm.addEventListener('submit', (e) => this._handleReadingFontSubmit(e));
    this.readingFontFileUpload.addEventListener('change', (e) => this._handleReadingFontFileUpload(e));
  }

  async render() {
    await this._renderDecorativeFont();
    await this._renderReadingFonts();
  }

  // --- Декоративный шрифт ---

  async _renderDecorativeFont() {
    const font = await this.store.getDecorativeFont();

    if (font) {
      this.decorativeFontInfo.hidden = false;
      this.decorativeFontName.textContent = font.name;

      this._loadCustomFontPreview('CustomDecorativePreview', font.dataUrl);
      this.decorativeFontSample.style.fontFamily = 'CustomDecorativePreview, sans-serif';
    } else {
      this.decorativeFontInfo.hidden = true;
      this.decorativeFontSample.style.fontFamily = '';
    }
  }

  async _handleDecorativeFontUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: MAX_DECORATIVE_FONT_SIZE, extensions: FONT_EXTENSIONS, inputEl: e.target })) return;

    let fontData;
    const uploadedUrl = await this.store.uploadFont(file);
    if (uploadedUrl) {
      fontData = uploadedUrl;
    } else {
      fontData = await readFileAsDataURL(file);
    }

    const name = file.name.replace(/\.[^.]+$/, '');
    this.store.setDecorativeFont({ name, dataUrl: fontData });
    this._renderDecorativeFont();
    this._renderJsonPreview();
    this._showToast(t('admin.fonts.decorativeLoaded'));
    e.target.value = '';
  }

  _removeDecorativeFont() {
    this.store.setDecorativeFont(null);
    this._renderDecorativeFont();
    this._renderJsonPreview();
    this._showToast(t('admin.fonts.decorativeReset'));
  }

  // --- Шрифты для чтения ---

  async _renderReadingFonts() {
    const fonts = await this.store.getReadingFonts();

    // Загрузить кастомные шрифты для предпросмотра
    fonts.forEach((f, i) => {
      if (!f.builtin && f.dataUrl) {
        this._loadCustomFontPreview(`CustomReading_${i}`, f.dataUrl);
      }
    });

    this.readingFontsList.innerHTML = fonts.map((f, i) => {
      const previewFamily = f.builtin ? f.family : `CustomReading_${i}, ${f.family.split(',').pop().trim()}`;
      const meta = f.builtin ? t('admin.fonts.builtin') : t('admin.fonts.custom');

      return `
        <div class="reading-font-card${f.enabled ? '' : ' disabled-font'}" data-index="${i}">
          <div class="reading-font-preview" style="font-family: ${this._escapeHtml(previewFamily)}">${t('admin.fonts.previewSample')}</div>
          <div class="reading-font-info">
            <div class="reading-font-label">${this._escapeHtml(f.label)}</div>
            <div class="reading-font-meta">${meta}</div>
          </div>
          <div class="reading-font-actions">
            <label class="admin-toggle" title="${f.enabled ? t('admin.fonts.disable') : t('admin.fonts.enable')}">
              <input type="checkbox" data-font-toggle="${i}" ${f.enabled ? 'checked' : ''}>
              <span class="admin-toggle-slider"></span>
            </label>
            ${!f.builtin ? `
              <button class="chapter-action-btn delete" data-font-delete="${i}" title="${t('common.delete')}">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Делегирование событий
    this.readingFontsList.onclick = async (e) => {
      const toggle = e.target.closest('[data-font-toggle]');
      if (toggle) {
        const idx = parseInt(toggle.dataset.fontToggle, 10);
        const fonts = await this.store.getReadingFonts();
        const enabledCount = fonts.filter(f => f.enabled).length;
        if (enabledCount <= 1 && !toggle.checked) {
          toggle.checked = true;
          this._showToast(t('admin.fonts.cannotDisableLast'));
          return;
        }
        await this.store.updateReadingFont(idx, { enabled: toggle.checked });
        await this._renderReadingFonts();
        await this.app.settings.render();
        this._renderJsonPreview();
        this._showToast(toggle.checked ? t('admin.fonts.enabled') : t('admin.fonts.disabled'));
        return;
      }

      const deleteBtn = e.target.closest('[data-font-delete]');
      if (deleteBtn) {
        this._confirm(t('admin.fonts.deleteConfirm')).then(async (ok) => {
          if (!ok) return;
          await this.store.removeReadingFont(parseInt(deleteBtn.dataset.fontDelete, 10));
          await this._renderReadingFonts();
          await this.app.settings.render();
          this._renderJsonPreview();
          this._showToast(t('admin.fonts.deleted'));
        });
      }
    };

    // Обновить <select> шрифта в настройках
    this.app.settings.updateFontSelect();
  }

  _openReadingFontModal() {
    this._pendingReadingFontDataUrl = null;
    this.readingFontUploadLabel.textContent = t('admin.fonts.selectFile');
    this.readingFontModalTitle.textContent = t('admin.modal.font.addTitle');
    this.readingFontForm.reset();
    this.readingFontModal.showModal();
  }

  async _handleReadingFontFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, extensions: FONT_EXTENSIONS, inputEl: e.target })) return;

    const uploadedUrl = await this.store.uploadFont(file);
    if (uploadedUrl) {
      this._pendingReadingFontDataUrl = uploadedUrl;
    } else {
      this._pendingReadingFontDataUrl = await readFileAsDataURL(file);
    }
    this.readingFontUploadLabel.textContent = file.name;
    e.target.value = '';
  }

  _handleReadingFontSubmit(e) {
    e.preventDefault();

    const label = this.readingFontNameInput.value.trim();
    if (!label) return;

    if (!this._pendingReadingFontDataUrl) {
      this._showToast(t('admin.fonts.validationRequired'));
      return;
    }

    const category = this.readingFontCategory.value;
    const id = `custom_${Date.now()}`;
    const family = `"${label}", ${category}`;

    this.store.addReadingFont({
      id,
      label,
      family,
      builtin: false,
      enabled: true,
      dataUrl: this._pendingReadingFontDataUrl,
    });

    this.readingFontModal.close();
    this._renderReadingFonts();
    this.app.settings.render();
    this._renderJsonPreview();
    this._showToast(t('admin.fonts.added'));
  }
}
