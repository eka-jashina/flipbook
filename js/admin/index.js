/**
 * Точка входа админ-панели
 */
import { AdminConfigStore } from './AdminConfigStore.js';

class AdminApp {
  constructor() {
    this.store = new AdminConfigStore();
    this._editingIndex = null; // индекс редактируемой главы (null = добавление)
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
    this.defaultAmbientBtns = document.querySelectorAll('#defaultAmbient .setting-ambient-btn');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');

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

    this.defaultAmbientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.defaultAmbientBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    this.saveSettingsBtn.addEventListener('click', () => this._saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this._resetSettings());

    // Экспорт
    this.exportBtn.addEventListener('click', () => this._exportConfig());
    this.importInput.addEventListener('change', (e) => this._importConfig(e));
    this.resetAllBtn.addEventListener('click', () => this._resetAll());
    this.copyJsonBtn.addEventListener('click', () => this._copyJson());
  }

  // --- Рендер ---

  _render() {
    this._renderChapters();
    this._renderSettings();
    this._renderJsonPreview();
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

    this.defaultAmbientBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ambient === s.ambientType);
    });
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
