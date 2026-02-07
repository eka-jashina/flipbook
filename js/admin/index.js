/**
 * Точка входа админ-панели
 */
import { AdminConfigStore } from './AdminConfigStore.js';

class AdminApp {
  constructor() {
    this.store = new AdminConfigStore();
    this._editingIndex = null; // индекс редактируемой главы (null = добавление)
    this._editingAmbientIndex = null; // индекс редактируемого амбиента
    this._pendingAmbientDataUrl = null; // data URL загруженного аудиофайла
    this._editTheme = 'light'; // текущая редактируемая тема оформления
    this._toastTimer = null;

    this._cacheDOM();
    this._bindEvents();
    this._render();
  }

  // --- DOM ---

  _cacheDOM() {
    // Табы
    this.tabs = document.querySelectorAll('.admin-tab');
    this.panels = document.querySelectorAll('.admin-panel');

    // Главы
    this.chaptersList = document.getElementById('chaptersList');
    this.chaptersEmpty = document.getElementById('chaptersEmpty');
    this.addChapterBtn = document.getElementById('addChapter');

    // Обложка (в табе Главы)
    this.coverTitle = document.getElementById('coverTitle');
    this.coverAuthor = document.getElementById('coverAuthor');
    this.coverBgInput = document.getElementById('coverBg');
    this.coverBgMobileInput = document.getElementById('coverBgMobile');
    this.saveCoverBtn = document.getElementById('saveCover');

    // Модальное окно
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputFile = document.getElementById('chapterFile');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');

    // Настройки
    this.defaultFont = document.getElementById('defaultFont');
    this.defaultFontSize = document.getElementById('defaultFontSize');
    this.fontSizeValue = document.getElementById('fontSizeValue');
    this.defaultThemeBtns = document.querySelectorAll('#defaultTheme .setting-theme-btn');
    this.defaultSound = document.getElementById('defaultSound');
    this.soundLabel = document.getElementById('soundLabel');
    this.defaultVolume = document.getElementById('defaultVolume');
    this.volumeValue = document.getElementById('volumeValue');
    this.defaultAmbientGroup = document.getElementById('defaultAmbient');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');

    // Звуки
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

    // Амбиенты
    this.ambientCards = document.getElementById('ambientCards');
    this.addAmbientBtn = document.getElementById('addAmbient');
    this.ambientModal = document.getElementById('ambientModal');
    this.ambientModalTitle = document.getElementById('ambientModalTitle');
    this.ambientForm = document.getElementById('ambientForm');
    this.cancelAmbientModal = document.getElementById('cancelAmbientModal');
    this.ambientLabelInput = document.getElementById('ambientLabel');
    this.ambientIconInput = document.getElementById('ambientIcon');
    this.ambientFileInput = document.getElementById('ambientFile');
    this.ambientFileUpload = document.getElementById('ambientFileUpload');
    this.ambientUploadLabel = document.getElementById('ambientUploadLabel');

    // Оформление — переключатель темы
    this.appearanceThemeBtns = document.querySelectorAll('#appearanceThemeSwitch .appearance-theme-btn');

    // Оформление — per-theme поля
    this.coverBgStart = document.getElementById('coverBgStart');
    this.coverBgEnd = document.getElementById('coverBgEnd');
    this.coverText = document.getElementById('coverText');
    this.coverTextPreview = document.getElementById('coverTextPreview');
    this.coverBgFileInput = document.getElementById('coverBgFileInput');
    this.coverBgPreview = document.getElementById('coverBgPreview');
    this.coverBgPreviewEmpty = document.getElementById('coverBgPreviewEmpty');
    this.coverBgRemove = document.getElementById('coverBgRemove');
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
    this.fontMin = document.getElementById('fontMin');
    this.fontMinValue = document.getElementById('fontMinValue');
    this.fontMax = document.getElementById('fontMax');
    this.fontMaxValue = document.getElementById('fontMaxValue');
    this.saveAppearanceBtn = document.getElementById('saveAppearance');
    this.resetAppearanceBtn = document.getElementById('resetAppearance');

    // Экспорт
    this.exportBtn = document.getElementById('exportConfig');
    this.importInput = document.getElementById('importConfig');
    this.resetAllBtn = document.getElementById('resetAll');
    this.jsonPreview = document.getElementById('jsonPreview');
    this.copyJsonBtn = document.getElementById('copyJson');

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');
  }

  // --- Привязка событий ---

  _bindEvents() {
    // Табы
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // Главы
    this.addChapterBtn.addEventListener('click', () => this._openModal());
    this.cancelModal.addEventListener('click', () => this.modal.close());
    this.chapterForm.addEventListener('submit', (e) => this._handleChapterSubmit(e));

    // Настройки
    this.defaultFontSize.addEventListener('input', () => {
      this.fontSizeValue.textContent = `${this.defaultFontSize.value}px`;
    });

    this.defaultSound.addEventListener('change', () => {
      this.soundLabel.textContent = this.defaultSound.checked ? 'Включён' : 'Выключен';
    });

    this.defaultVolume.addEventListener('input', () => {
      this.volumeValue.textContent = `${this.defaultVolume.value}%`;
    });

    this.defaultThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.defaultThemeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    this.defaultAmbientGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.setting-ambient-btn');
      if (!btn) return;
      this.defaultAmbientGroup.querySelectorAll('.setting-ambient-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    this.saveSettingsBtn.addEventListener('click', () => this._saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this._resetSettings());

    // Амбиенты
    this.addAmbientBtn.addEventListener('click', () => this._openAmbientModal());
    this.cancelAmbientModal.addEventListener('click', () => this.ambientModal.close());
    this.ambientForm.addEventListener('submit', (e) => this._handleAmbientSubmit(e));
    this.ambientFileUpload.addEventListener('change', (e) => this._handleAmbientFileUpload(e));

    // Звуки
    this.soundPageFlipUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'pageFlip'));
    this.soundBookOpenUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'bookOpen'));
    this.soundBookCloseUpload.addEventListener('change', (e) => this._handleSoundUpload(e, 'bookClose'));
    this.saveSoundsBtn.addEventListener('click', () => this._saveSounds());
    this.resetSoundsBtn.addEventListener('click', () => this._resetSounds());

    // Обложка (таб Главы)
    this.saveCoverBtn.addEventListener('click', () => this._saveCover());

    // Оформление — переключатель темы
    this.appearanceThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => this._switchEditTheme(btn.dataset.editTheme));
    });

    // Оформление — живой предпросмотр
    this.coverBgStart.addEventListener('input', () => this._updateAppearancePreview());
    this.coverBgEnd.addEventListener('input', () => this._updateAppearancePreview());
    this.coverText.addEventListener('input', () => this._updateAppearancePreview());
    this.coverBgFileInput.addEventListener('change', (e) => this._handleCoverBgUpload(e));
    this.coverBgRemove.addEventListener('click', () => this._removeCoverBg());
    // Текстура — выбор варианта
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
    this.fontMin.addEventListener('input', () => {
      this.fontMinValue.textContent = `${this.fontMin.value}px`;
    });
    this.fontMax.addEventListener('input', () => {
      this.fontMaxValue.textContent = `${this.fontMax.value}px`;
    });

    this.saveAppearanceBtn.addEventListener('click', () => this._saveAppearance());
    this.resetAppearanceBtn.addEventListener('click', () => this._resetAppearance());

    // Экспорт
    this.exportBtn.addEventListener('click', () => this._exportConfig());
    this.importInput.addEventListener('change', (e) => this._importConfig(e));
    this.resetAllBtn.addEventListener('click', () => this._resetAll());
    this.copyJsonBtn.addEventListener('click', () => this._copyJson());
  }

  // --- Рендер ---

  _render() {
    this._renderCover();
    this._renderChapters();
    this._renderAmbients();
    this._renderSounds();
    this._renderSettings();
    this._renderAppearance();
    this._renderJsonPreview();
  }

  _renderCover() {
    const cover = this.store.getCover();
    this.coverTitle.value = cover.title;
    this.coverAuthor.value = cover.author;
    this.coverBgInput.value = cover.bg || '';
    this.coverBgMobileInput.value = cover.bgMobile || '';
  }

  _renderChapters() {
    const chapters = this.store.getChapters();

    if (chapters.length === 0) {
      this.chaptersList.innerHTML = '';
      this.chaptersEmpty.hidden = false;
      return;
    }

    this.chaptersEmpty.hidden = true;
    this.chaptersList.innerHTML = chapters.map((ch, i) => `
      <div class="chapter-card" data-index="${i}">
        <div class="chapter-drag" title="Перетащите для изменения порядка">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <div class="chapter-info">
          <div class="chapter-title">${this._escapeHtml(ch.id)}</div>
          <div class="chapter-meta">${this._escapeHtml(ch.file)}</div>
        </div>
        <div class="chapter-actions">
          ${i > 0 ? `<button class="chapter-action-btn" data-action="up" data-index="${i}" title="Вверх">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>` : ''}
          ${i < chapters.length - 1 ? `<button class="chapter-action-btn" data-action="down" data-index="${i}" title="Вниз">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>` : ''}
          <button class="chapter-action-btn" data-action="edit" data-index="${i}" title="Редактировать">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="chapter-action-btn delete" data-action="delete" data-index="${i}" title="Удалить">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Делегирование событий на кнопки
    this.chaptersList.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.index, 10);

      switch (action) {
        case 'up':
          this.store.moveChapter(index, index - 1);
          this._renderChapters();
          this._renderJsonPreview();
          this._showToast('Порядок изменён');
          break;
        case 'down':
          this.store.moveChapter(index, index + 1);
          this._renderChapters();
          this._renderJsonPreview();
          this._showToast('Порядок изменён');
          break;
        case 'edit':
          this._openModal(index);
          break;
        case 'delete':
          if (confirm('Удалить эту главу?')) {
            this.store.removeChapter(index);
            this._renderChapters();
            this._renderJsonPreview();
            this._showToast('Глава удалена');
          }
          break;
      }
    };
  }

  _renderSettings() {
    const s = this.store.getDefaultSettings();

    this.defaultFont.value = s.font;
    this.defaultFontSize.value = s.fontSize;
    this.fontSizeValue.textContent = `${s.fontSize}px`;

    this.defaultThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === s.theme);
    });

    this.defaultSound.checked = s.soundEnabled;
    this.soundLabel.textContent = s.soundEnabled ? 'Включён' : 'Выключен';
    this.defaultVolume.value = Math.round(s.soundVolume * 100);
    this.volumeValue.textContent = `${Math.round(s.soundVolume * 100)}%`;

    // Динамически заполнить кнопки амбиентов (только видимые)
    const ambients = this.store.getAmbients().filter(a => a.visible);
    this.defaultAmbientGroup.innerHTML = ambients.map(a =>
      `<button class="setting-ambient-btn${a.id === s.ambientType ? ' active' : ''}" type="button" data-ambient="${this._escapeHtml(a.id)}">${this._escapeHtml(a.icon)} ${this._escapeHtml(a.shortLabel || a.label)}</button>`
    ).join('');
  }

  _renderJsonPreview() {
    this.jsonPreview.textContent = this.store.exportJSON();
  }

  // --- Табы ---

  _switchTab(tabName) {
    this.tabs.forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });

    this.panels.forEach(p => {
      const isActive = p.dataset.panel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });

    if (tabName === 'export') {
      this._renderJsonPreview();
    }
  }

  // --- Модальное окно главы ---

  _openModal(editIndex = null) {
    this._editingIndex = editIndex;

    if (editIndex !== null) {
      const ch = this.store.getChapters()[editIndex];
      this.modalTitle.textContent = 'Редактировать главу';
      this.inputId.value = ch.id;
      this.inputFile.value = ch.file;
      this.inputBg.value = ch.bg || '';
      this.inputBgMobile.value = ch.bgMobile || '';
    } else {
      this.modalTitle.textContent = 'Добавить главу';
      this.chapterForm.reset();
    }

    this.modal.showModal();
  }

  _handleChapterSubmit(e) {
    e.preventDefault();

    const chapter = {
      id: this.inputId.value.trim(),
      file: this.inputFile.value.trim(),
      bg: this.inputBg.value.trim(),
      bgMobile: this.inputBgMobile.value.trim(),
    };

    if (!chapter.id || !chapter.file) return;

    if (this._editingIndex !== null) {
      this.store.updateChapter(this._editingIndex, chapter);
      this._showToast('Глава обновлена');
    } else {
      this.store.addChapter(chapter);
      this._showToast('Глава добавлена');
    }

    this.modal.close();
    this._renderChapters();
    this._renderJsonPreview();
  }

  // --- Обложка ---

  _saveCover() {
    this.store.updateCover({
      title: this.coverTitle.value.trim(),
      author: this.coverAuthor.value.trim(),
      bg: this.coverBgInput.value.trim(),
      bgMobile: this.coverBgMobileInput.value.trim(),
    });

    this._renderJsonPreview();
    this._showToast('Обложка сохранена');
  }

  // --- Амбиенты ---

  _renderAmbients() {
    const ambients = this.store.getAmbients();

    this.ambientCards.innerHTML = ambients.map((a, i) => {
      const isNone = a.id === 'none';
      const meta = a.file
        ? this._escapeHtml(a.file.startsWith('data:') ? 'Загруженный файл' : a.file)
        : 'Нет файла';

      return `
        <div class="ambient-card${a.visible ? '' : ' hidden-ambient'}" data-index="${i}">
          <div class="ambient-card-icon">${this._escapeHtml(a.icon)}</div>
          <div class="ambient-card-info">
            <div class="ambient-card-label">${this._escapeHtml(a.label)}</div>
            <div class="ambient-card-meta">${meta}</div>
          </div>
          <div class="ambient-card-actions">
            ${!isNone ? `
              <label class="admin-toggle" title="${a.visible ? 'Скрыть' : 'Показать'}">
                <input type="checkbox" data-ambient-toggle="${i}" ${a.visible ? 'checked' : ''}>
                <span class="admin-toggle-slider"></span>
              </label>
            ` : ''}
            ${!a.builtin ? `
              <button class="chapter-action-btn" data-ambient-edit="${i}" title="Редактировать">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="chapter-action-btn delete" data-ambient-delete="${i}" title="Удалить">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Делегирование событий
    this.ambientCards.onclick = (e) => {
      const toggle = e.target.closest('[data-ambient-toggle]');
      if (toggle) {
        const idx = parseInt(toggle.dataset.ambientToggle, 10);
        this.store.updateAmbient(idx, { visible: toggle.checked });
        this._renderAmbients();
        this._renderSettings();
        this._renderJsonPreview();
        this._showToast(toggle.checked ? 'Атмосфера показана' : 'Атмосфера скрыта');
        return;
      }

      const editBtn = e.target.closest('[data-ambient-edit]');
      if (editBtn) {
        this._openAmbientModal(parseInt(editBtn.dataset.ambientEdit, 10));
        return;
      }

      const deleteBtn = e.target.closest('[data-ambient-delete]');
      if (deleteBtn) {
        if (confirm('Удалить эту атмосферу?')) {
          this.store.removeAmbient(parseInt(deleteBtn.dataset.ambientDelete, 10));
          this._renderAmbients();
          this._renderSettings();
          this._renderJsonPreview();
          this._showToast('Атмосфера удалена');
        }
      }
    };
  }

  _openAmbientModal(editIndex = null) {
    this._editingAmbientIndex = editIndex;
    this._pendingAmbientDataUrl = null;
    this.ambientUploadLabel.textContent = 'Выбрать файл';

    if (editIndex !== null) {
      const a = this.store.getAmbients()[editIndex];
      this.ambientModalTitle.textContent = 'Редактировать атмосферу';
      this.ambientLabelInput.value = a.label;
      this.ambientIconInput.value = a.icon;
      this.ambientFileInput.value = a.file && !a.file.startsWith('data:') ? a.file : '';
      if (a.file && a.file.startsWith('data:')) {
        this._pendingAmbientDataUrl = a.file;
        this.ambientUploadLabel.textContent = 'Файл загружен';
      }
    } else {
      this.ambientModalTitle.textContent = 'Добавить атмосферу';
      this.ambientForm.reset();
    }

    this.ambientModal.showModal();
  }

  _handleAmbientFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this._showToast('Файл слишком большой (макс. 5 МБ)');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('audio/')) {
      this._showToast('Допустимы только аудиофайлы');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this._pendingAmbientDataUrl = reader.result;
      this.ambientUploadLabel.textContent = file.name;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _handleAmbientSubmit(e) {
    e.preventDefault();

    const label = this.ambientLabelInput.value.trim();
    const icon = this.ambientIconInput.value.trim();
    const filePath = this.ambientFileInput.value.trim();

    if (!label || !icon) return;

    const file = this._pendingAmbientDataUrl || filePath || null;
    if (!file) {
      this._showToast('Укажите путь к файлу или загрузите аудио');
      return;
    }

    const id = this._editingAmbientIndex !== null
      ? this.store.getAmbients()[this._editingAmbientIndex].id
      : `custom_${Date.now()}`;

    const shortLabel = label.length > 8 ? label.slice(0, 8) : label;

    const ambient = { id, label, shortLabel, icon, file, visible: true, builtin: false };

    if (this._editingAmbientIndex !== null) {
      this.store.updateAmbient(this._editingAmbientIndex, ambient);
      this._showToast('Атмосфера обновлена');
    } else {
      this.store.addAmbient(ambient);
      this._showToast('Атмосфера добавлена');
    }

    this.ambientModal.close();
    this._renderAmbients();
    this._renderSettings();
    this._renderJsonPreview();
  }

  // --- Звуки ---

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

    if (file.size > 2 * 1024 * 1024) {
      this._showToast('Файл слишком большой (макс. 2 МБ)');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('audio/')) {
      this._showToast('Допустимы только аудиофайлы');
      e.target.value = '';
      return;
    }

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

    // Сохраняем только если есть изменения в полях, иначе оставляем текущие значения
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

  // --- Настройки ---

  _saveSettings() {
    const activeTheme = document.querySelector('#defaultTheme .setting-theme-btn.active');
    const activeAmbient = document.querySelector('#defaultAmbient .setting-ambient-btn.active');

    this.store.updateDefaultSettings({
      font: this.defaultFont.value,
      fontSize: parseInt(this.defaultFontSize.value, 10),
      theme: activeTheme ? activeTheme.dataset.theme : 'light',
      soundEnabled: this.defaultSound.checked,
      soundVolume: parseInt(this.defaultVolume.value, 10) / 100,
      ambientType: activeAmbient ? activeAmbient.dataset.ambient : 'none',
    });

    this._renderJsonPreview();
    this._showToast('Настройки сохранены');
  }

  _resetSettings() {
    this.store.updateDefaultSettings({
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    this._renderSettings();
    this._renderJsonPreview();
    this._showToast('Настройки сброшены');
  }

  // --- Оформление ---

  /** Переключить редактируемую тему */
  _switchEditTheme(theme) {
    this._saveCurrentThemeFromForm();
    this._editTheme = theme;
    this.appearanceThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.editTheme === theme);
    });
    this._renderAppearanceThemeFields();
    this._updateAppearancePreview();
  }

  /** Сохранить per-theme поля из формы в store */
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

    // Глобальные поля
    this.fontMin.value = a.fontMin;
    this.fontMinValue.textContent = `${a.fontMin}px`;
    this.fontMax.value = a.fontMax;
    this.fontMaxValue.textContent = `${a.fontMax}px`;

    // Per-theme поля
    this._renderAppearanceThemeFields();
    this._updateAppearancePreview();
  }

  /** Заполнить per-theme поля из store для текущей _editTheme */
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

    if (file.size > 2 * 1024 * 1024) {
      this._showToast('Файл слишком большой (макс. 2 МБ)');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this._showToast('Допустимы только изображения');
      e.target.value = '';
      return;
    }

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

    // Подсветка активного варианта
    this.textureOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.texture === textureValue);
    });

    // Если выбрана кастомная текстура
    if (textureValue === 'custom') {
      uploadOption.classList.add('active');
    } else {
      uploadOption.classList.remove('active');
    }

    // Показать превью кастомной текстуры
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

    // Ограничение размера — 2 МБ
    if (file.size > 2 * 1024 * 1024) {
      this._showToast('Файл слишком большой (макс. 2 МБ)');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this._showToast('Допустимы только изображения');
      e.target.value = '';
      return;
    }

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

    // Сброс input
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

  _saveAppearance() {
    // Глобальные поля
    this.store.updateAppearanceGlobal({
      fontMin: parseInt(this.fontMin.value, 10),
      fontMax: parseInt(this.fontMax.value, 10),
    });

    // Per-theme поля из формы
    this._saveCurrentThemeFromForm();

    this._renderJsonPreview();
    this._showToast('Оформление сохранено');
  }

  _resetAppearance() {
    this.store.updateAppearanceGlobal({ fontMin: 14, fontMax: 22 });

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

    this._renderAppearance();
    this._renderJsonPreview();
    this._showToast('Оформление сброшено');
  }

  // --- Экспорт/Импорт ---

  _exportConfig() {
    const json = this.store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'flipbook-config.json';
    a.click();

    URL.revokeObjectURL(url);
    this._showToast('Конфигурация скачана');
  }

  _importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importJSON(reader.result);
        this._render();
        this._showToast('Конфигурация загружена');
      } catch {
        this._showToast('Ошибка: неверный формат JSON');
      }
    };
    reader.readAsText(file);

    // Сброс input чтобы можно было загрузить тот же файл повторно
    e.target.value = '';
  }

  _resetAll() {
    if (confirm('Сбросить все настройки админки? Ридер вернётся к конфигурации по умолчанию.')) {
      this.store.clear();
      this._render();
      this._showToast('Всё сброшено');
    }
  }

  _copyJson() {
    navigator.clipboard.writeText(this.store.exportJSON()).then(() => {
      this._showToast('Скопировано в буфер');
    });
  }

  // --- Утилиты ---

  _showToast(message) {
    this.toastMessage.textContent = message;
    this.toast.hidden = false;

    // Запускаем анимацию появления
    requestAnimationFrame(() => {
      this.toast.classList.add('visible');
    });

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.classList.remove('visible');
      setTimeout(() => { this.toast.hidden = true; }, 300);
    }, 2500);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Запуск
new AdminApp();
