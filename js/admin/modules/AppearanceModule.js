/**
 * Модуль оформления: темы, текстуры, фон обложки, цвета
 * Работает внутри табов «Обложка» (cover colors) и «Оформление» (page textures/colors)
 */
import { BaseModule } from './BaseModule.js';

export class AppearanceModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editTheme = 'light';
  }

  cacheDOM() {
    // Переключатель темы (в editor → cover tab и appearance tab)
    this.coverThemeBtns = document.querySelectorAll('#appearanceThemeSwitch .appearance-theme-btn');
    this.pageThemeBtns = document.querySelectorAll('#pageThemeSwitch .appearance-theme-btn');
    this.appearanceThemeBtns = document.querySelectorAll('#appearanceThemeSwitch .appearance-theme-btn, #pageThemeSwitch .appearance-theme-btn');

    // Cover per-theme fields (editor → cover tab)
    this.coverBgStart = document.getElementById('coverBgStart');
    this.coverBgEnd = document.getElementById('coverBgEnd');
    this.coverText = document.getElementById('coverText');
    this.coverTextPreview = document.getElementById('coverTextPreview');
    this.coverBgFileInput = document.getElementById('coverBgFileInput');
    this.coverBgPreview = document.getElementById('coverBgPreview');
    this.coverBgPreviewEmpty = document.getElementById('coverBgPreviewEmpty');
    this.coverBgRemove = document.getElementById('coverBgRemove');

    // Page appearance fields (editor → appearance tab)
    this.pageTexture = document.getElementById('pageTexture');
    this.textureOptions = document.querySelectorAll('.texture-option[data-texture]');
    this.textureFileInput = document.getElementById('textureFileInput');
    this.customTextureThumb = document.getElementById('customTextureThumb');
    this.textureCustomInfo = document.getElementById('textureCustomInfo');
    this.textureCustomName = document.getElementById('textureCustomName');
    this.textureCustomRemove = document.getElementById('textureCustomRemove');
    this.bgPage = document.getElementById('bgPage');
    this.bgPageSwatch = document.getElementById('bgPageSwatch');
    this.bgApp = document.getElementById('bgApp');
    this.bgAppSwatch = document.getElementById('bgAppSwatch');
    this.saveAppearanceBtn = document.getElementById('saveAppearance');
    this.resetAppearanceBtn = document.getElementById('resetAppearance');

    // Platform settings: fontMin/fontMax
    this.fontMin = document.getElementById('fontMin');
    this.fontMinValue = document.getElementById('fontMinValue');
    this.fontMax = document.getElementById('fontMax');
    this.fontMaxValue = document.getElementById('fontMaxValue');
    this.savePlatformBtn = document.getElementById('savePlatform');
  }

  bindEvents() {
    // Переключатель темы
    this.appearanceThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => this._switchEditTheme(btn.dataset.editTheme));
    });

    // Живой предпросмотр (cover)
    this.coverBgStart.addEventListener('input', () => this._updateAppearancePreview());
    this.coverBgEnd.addEventListener('input', () => this._updateAppearancePreview());
    this.coverText.addEventListener('input', () => this._updateAppearancePreview());
    this.coverBgFileInput.addEventListener('change', (e) => this._handleCoverBgUpload(e));
    this.coverBgRemove.addEventListener('click', () => this._removeCoverBg());

    // Текстура — выбор варианта (appearance tab)
    this.textureOptions.forEach(btn => {
      btn.addEventListener('click', () => this._selectTexture(btn.dataset.texture));
    });
    this.textureFileInput.addEventListener('change', (e) => this._handleTextureUpload(e));
    this.textureCustomRemove.addEventListener('click', () => this._removeCustomTexture());

    this.bgPage.addEventListener('input', () => {
      this.bgPageSwatch.style.background = this.bgPage.value;
    });
    this.bgApp.addEventListener('input', () => {
      this.bgAppSwatch.style.background = this.bgApp.value;
    });

    // Platform font limits
    this.fontMin.addEventListener('input', () => {
      this.fontMinValue.textContent = `${this.fontMin.value}px`;
    });
    this.fontMax.addEventListener('input', () => {
      this.fontMaxValue.textContent = `${this.fontMax.value}px`;
    });

    this.saveAppearanceBtn.addEventListener('click', () => this._saveAppearance());
    this.resetAppearanceBtn.addEventListener('click', () => this._resetAppearance());

    // Platform save (visibility + fonts + fontMin/fontMax)
    this.savePlatformBtn.addEventListener('click', () => this._savePlatform());
  }

  render() {
    this._renderAppearance();
  }

  // --- Оформление ---

  _switchEditTheme(theme) {
    this._saveCurrentThemeFromForm();
    this._editTheme = theme;
    // Синхронизируем оба переключателя (cover + pages)
    this.coverThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editTheme === theme);
    });
    this.pageThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editTheme === theme);
    });
    this._renderAppearanceThemeFields();
    this._updateAppearancePreview();
  }

  _saveCurrentThemeFromForm() {
    const data = {
      coverBgStart: this.coverBgStart.value,
      coverBgEnd: this.coverBgEnd.value,
      coverText: this.coverText.value,
      pageTexture: this.pageTexture.value,
      bgPage: this.bgPage.value,
      bgApp: this.bgApp.value,
    };
    if (data.pageTexture !== 'custom') {
      data.customTextureData = null;
    }
    this.store.updateAppearanceTheme(this._editTheme, data);
  }

  _renderAppearance() {
    const a = this.store.getAppearance();

    // Platform font limits
    this.fontMin.value = a.fontMin;
    this.fontMinValue.textContent = `${a.fontMin}px`;
    this.fontMax.value = a.fontMax;
    this.fontMaxValue.textContent = `${a.fontMax}px`;

    // Per-theme поля
    this._renderAppearanceThemeFields();
    this._updateAppearancePreview();
  }

  _renderAppearanceThemeFields() {
    const a = this.store.getAppearance();
    const t = a[this._editTheme] || a.light;

    this.coverBgStart.value = t.coverBgStart;
    this.coverBgEnd.value = t.coverBgEnd;
    this.coverText.value = t.coverText;
    this._renderCoverBgPreview(t.coverBgImage);
    this.pageTexture.value = t.pageTexture;
    this._renderTextureSelector(t.pageTexture, t.customTextureData);
    this.bgPage.value = t.bgPage;
    this.bgPageSwatch.style.background = t.bgPage;
    this.bgApp.value = t.bgApp;
    this.bgAppSwatch.style.background = t.bgApp;
  }

  _updateAppearancePreview() {
    const bg = `linear-gradient(135deg, ${this.coverBgStart.value}, ${this.coverBgEnd.value})`;
    this.coverTextPreview.style.background = bg;
    this.coverTextPreview.style.color = this.coverText.value;
    const cover = this.store.getCover();
    this.coverTextPreview.textContent = cover.title || 'Заголовок';
  }

  // --- Фон обложки ---

  _renderCoverBgPreview(imageData) {
    if (imageData) {
      this.coverBgPreview.style.backgroundImage = `url(${imageData})`;
      this.coverBgPreview.classList.add('has-image');
      this.coverBgPreviewEmpty.hidden = true;
      this.coverBgRemove.hidden = false;
    } else {
      this.coverBgPreview.style.backgroundImage = '';
      this.coverBgPreview.classList.remove('has-image');
      this.coverBgPreviewEmpty.hidden = false;
      this.coverBgRemove.hidden = true;
    }
  }

  _handleCoverBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'image/', inputEl: e.target })) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      this.store.updateAppearanceTheme(this._editTheme, { coverBgImage: dataUrl });
      this._renderCoverBgPreview(dataUrl);
      this._renderJsonPreview();
      this._showToast('Фон обложки загружен');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _removeCoverBg() {
    this.store.updateAppearanceTheme(this._editTheme, { coverBgImage: null });
    this._renderCoverBgPreview(null);
    this._renderJsonPreview();
    this._showToast('Фон обложки удалён');
  }

  // --- Текстура ---

  _renderTextureSelector(textureValue, customData) {
    const uploadOption = document.querySelector('.texture-option--upload');

    this.textureOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.texture === textureValue);
    });

    if (textureValue === 'custom') {
      uploadOption.classList.add('active');
    } else {
      uploadOption.classList.remove('active');
    }

    if (customData) {
      this.customTextureThumb.style.backgroundImage = `url(${customData})`;
      this.customTextureThumb.classList.add('has-image');
      this.textureCustomInfo.hidden = false;
      this.textureCustomName.textContent = 'Своя текстура';
    } else {
      this.customTextureThumb.style.backgroundImage = '';
      this.customTextureThumb.classList.remove('has-image');
      this.textureCustomInfo.hidden = true;
    }
  }

  _selectTexture(value) {
    this.pageTexture.value = value;
    const t = this.store.getAppearance()[this._editTheme];
    this._renderTextureSelector(value, t?.customTextureData);
  }

  _handleTextureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'image/', inputEl: e.target })) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;

      this.store.updateAppearanceTheme(this._editTheme, {
        pageTexture: 'custom',
        customTextureData: dataUrl,
      });

      this.pageTexture.value = 'custom';
      this._renderTextureSelector('custom', dataUrl);
      this._renderJsonPreview();
      this._showToast('Текстура загружена');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _removeCustomTexture() {
    this.store.updateAppearanceTheme(this._editTheme, {
      pageTexture: 'default',
      customTextureData: null,
    });

    this.pageTexture.value = 'default';
    this._renderTextureSelector('default', null);
    this._renderJsonPreview();
    this._showToast('Своя текстура удалена');
  }

  // --- Сохранение per-book (appearance tab) ---

  _saveAppearance() {
    this._saveCurrentThemeFromForm();
    this._renderJsonPreview();
    this._showToast('Оформление сохранено');
  }

  _resetAppearance() {
    this.store.updateAppearanceTheme('light', {
      coverBgStart: '#3a2d1f',
      coverBgEnd: '#2a2016',
      coverText: '#f2e9d8',
      coverBgImage: null,
      pageTexture: 'default',
      customTextureData: null,
      bgPage: '#fdfcf8',
      bgApp: '#e6e3dc',
    });

    this.store.updateAppearanceTheme('dark', {
      coverBgStart: '#111111',
      coverBgEnd: '#000000',
      coverText: '#eaeaea',
      coverBgImage: null,
      pageTexture: 'none',
      customTextureData: null,
      bgPage: '#1e1e1e',
      bgApp: '#121212',
    });

    this._renderAppearanceThemeFields();
    this._updateAppearancePreview();
    this._renderJsonPreview();
    this._showToast('Оформление сброшено');
  }

  // --- Сохранение platform settings (fontMin/fontMax + visibility) ---

  _savePlatform() {
    this.store.updateAppearanceGlobal({
      fontMin: parseInt(this.fontMin.value, 10),
      fontMax: parseInt(this.fontMax.value, 10),
    });

    this._renderJsonPreview();
    this._showToast('Настройки платформы сохранены');
  }
}
