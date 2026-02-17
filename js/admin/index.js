/**
 * Точка входа админ-панели
 * Роутер экранов + инициализация модулей
 */
import { AdminConfigStore } from './AdminConfigStore.js';
import { ChaptersModule } from './modules/ChaptersModule.js';
import { SettingsModule } from './modules/SettingsModule.js';
import { SoundsModule } from './modules/SoundsModule.js';
import { AmbientsModule } from './modules/AmbientsModule.js';
import { AppearanceModule } from './modules/AppearanceModule.js';
import { FontsModule } from './modules/FontsModule.js';
import { ExportModule } from './modules/ExportModule.js';

class AdminApp {
  constructor(store) {
    this.store = store;
    this._toastTimer = null;

    // Инициализация модулей
    this.chapters = new ChaptersModule(this);
    this.settings = new SettingsModule(this);
    this.sounds = new SoundsModule(this);
    this.ambients = new AmbientsModule(this);
    this.appearance = new AppearanceModule(this);
    this.fonts = new FontsModule(this);
    this.export = new ExportModule(this);

    this._modules = [
      this.chapters, this.settings, this.sounds,
      this.ambients, this.appearance, this.fonts, this.export,
    ];

    this._cacheDOM();
    this._bindEvents();
    this._render();
    this._handleUrlMode();
  }

  // --- DOM ---

  _cacheDOM() {
    // Табы верхнего уровня
    this.tabs = document.querySelectorAll('.admin-tab');
    this.panels = document.querySelectorAll('.admin-panel');

    // Экраны (вью) внутри таба «Мои книги»
    this.screenViews = document.querySelectorAll('.screen-view');

    // Табы редактора книги
    this.editorTabs = document.querySelectorAll('.editor-tab');
    this.editorPanels = document.querySelectorAll('.editor-panel');
    this.editorTitle = document.getElementById('editorTitle');

    // Кнопки навигации между экранами
    this.addBookBtn = document.getElementById('addBookBtn');
    this.modeSelectorBack = document.getElementById('modeSelectorBack');
    this.uploadBack = document.getElementById('uploadBack');
    this.editorBack = document.getElementById('editorBack');
    this.albumBack = document.getElementById('albumBack');

    // Карточки режимов
    this.modeCards = document.querySelectorAll('.mode-card');

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');

    // DOM для модулей
    this._modules.forEach(m => m.cacheDOM());
  }

  // --- Привязка событий ---

  _bindEvents() {
    // Табы верхнего уровня
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // Навигация по экранам
    this.addBookBtn.addEventListener('click', () => this._showView('mode-selector'));
    this.modeSelectorBack.addEventListener('click', () => this._showView('bookshelf'));
    this.uploadBack.addEventListener('click', () => this._showView('mode-selector'));
    this.editorBack.addEventListener('click', () => this._showView('bookshelf'));
    this.albumBack.addEventListener('click', () => this._showView('editor'));

    // Карточки выбора режима
    this.modeCards.forEach(card => {
      card.addEventListener('click', () => this._handleModeSelect(card.dataset.mode));
    });

    // Табы редактора
    this.editorTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchEditorTab(tab.dataset.editorTab));
    });

    // События модулей
    this._modules.forEach(m => m.bindEvents());
  }

  // --- Рендер ---

  _render() {
    this._modules.forEach(m => m.render());
  }

  _renderJsonPreview() {
    this.export.renderJsonPreview();
  }

  // --- Обработка URL-параметра ?mode= ---

  _handleUrlMode() {
    const mode = sessionStorage.getItem('flipbook-admin-mode');
    if (!mode) return;

    // Удаляем сразу, чтобы при обновлении не повторялось
    sessionStorage.removeItem('flipbook-admin-mode');

    // Переключаемся на вкладку «Мои книги» и запускаем выбранный режим
    this._switchTab('books');
    this._handleModeSelect(mode);
  }

  // --- Табы верхнего уровня ---

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

  // --- Навигация по экранам (вью) ---

  _showView(viewName) {
    this.screenViews.forEach(v => {
      const isActive = v.dataset.view === viewName;
      v.classList.toggle('active', isActive);
      v.hidden = !isActive;
    });
  }

  _handleModeSelect(mode) {
    switch (mode) {
      case 'upload':
        this._showView('upload');
        break;
      case 'edit':
        // Открыть редактор для текущей активной книги
        this._render();
        this.openEditor();
        break;
      case 'manual': {
        // Создать новую пустую книгу и открыть редактор
        const bookId = `book_${Date.now()}`;
        this.store.addBook({
          id: bookId,
          cover: { title: 'Новая книга', author: '', bg: '', bgMobile: '' },
          chapters: [],
        });
        this.store.setActiveBook(bookId);
        this._render();
        this.openEditor();
        break;
      }
      case 'album':
        this._showView('album');
        this.chapters._album.openInView();
        break;
    }
  }

  /** Открыть редактор для текущей активной книги */
  openEditor() {
    const cover = this.store.getCover();
    this.editorTitle.textContent = cover.title || 'Редактор книги';
    this._switchEditorTab('cover');
    this._showView('editor');
  }

  // --- Табы редактора ---

  _switchEditorTab(tabName) {
    this.editorTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.editorTab === tabName);
    });
    this.editorPanels.forEach(p => {
      const isActive = p.dataset.editorPanel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });
  }

  // --- Утилиты ---

  _showToast(message) {
    this.toastMessage.textContent = message;
    this.toast.hidden = false;

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

// Запуск (асинхронная инициализация из-за IndexedDB)
AdminConfigStore.create().then(store => new AdminApp(store));
