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
import { renderModeCards } from './modeCardsData.js';

class AdminApp {
  constructor(store) {
    this.store = store;
    this._toastTimer = null;
    /** ID книги, созданной через «Создать вручную» (ещё не подтверждённой) */
    this._pendingBookId = null;

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
    this.editorTabsWrapper = document.getElementById('editorTabsWrapper');
    this.editorTabsContainer = document.getElementById('editorTabs');
    this.editorTabs = document.querySelectorAll('.editor-tab');
    this.editorPanels = document.querySelectorAll('.editor-panel');
    this.editorTitle = document.getElementById('editorTitle');

    // Кнопки навигации между экранами
    this.addBookBtn = document.getElementById('addBookBtn');
    this.modeSelectorBack = document.getElementById('modeSelectorBack');
    this.uploadBack = document.getElementById('uploadBack');
    this.editorBack = document.getElementById('editorBack');
    this.albumBack = document.getElementById('albumBack');
    this.toShelfLink = document.getElementById('toShelfLink');

    // Контейнер карточек режимов (карточки генерируются динамически)
    this.modeCardsContainer = document.getElementById('modeCards');
    renderModeCards(this.modeCardsContainer);

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');

    // Confirm dialog
    this.confirmDialog = document.getElementById('confirmDialog');
    this.confirmTitle = document.getElementById('confirmTitle');
    this.confirmMessage = document.getElementById('confirmMessage');
    this.confirmOk = document.getElementById('confirmOk');
    this.confirmCancel = document.getElementById('confirmCancel');

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
    this.editorBack.addEventListener('click', () => {
      this._cleanupPendingBook();
      this._showView('bookshelf');
    });
    this.albumBack.addEventListener('click', () => {
      const hadPending = !!this._pendingBookId;
      this._cleanupPendingBook();
      this._showView(hadPending ? 'bookshelf' : 'editor');
    });

    // «На книжную полку» — очистить незавершённую книгу перед уходом
    this.toShelfLink.addEventListener('click', () => {
      this._cleanupPendingBook();
    });

    // Карточки выбора режима (делегирование событий)
    this.modeCardsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) this._handleModeSelect(card.dataset.mode);
    });

    // Табы редактора
    this.editorTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchEditorTab(tab.dataset.editorTab));
    });

    // Индикация горизонтального скролла для editor-tabs
    this._updateTabsScroll();
    this.editorTabsContainer.addEventListener('scroll', () => this._updateTabsScroll());
    window.addEventListener('resize', () => this._updateTabsScroll());

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
      case 'edit': {
        // Открыть редактор для указанной книги
        const editBookId = sessionStorage.getItem('flipbook-admin-edit-book');
        sessionStorage.removeItem('flipbook-admin-edit-book');
        if (editBookId) this.store.setActiveBook(editBookId);
        this._render();
        this.openEditor();
        break;
      }
      case 'manual': {
        // Создать новую пустую книгу и открыть редактор
        const bookId = `book_${Date.now()}`;
        this.store.addBook({
          id: bookId,
          cover: { title: 'Новая книга', author: '', bg: '', bgMobile: '' },
          chapters: [],
        });
        this.store.setActiveBook(bookId);
        this._pendingBookId = bookId;
        this._render();
        this.openEditor();
        break;
      }
      case 'album': {
        // Создать новую книгу-альбом и открыть редактор альбома
        const albumBookId = `book_${Date.now()}`;
        this.store.addBook({
          id: albumBookId,
          cover: { title: 'Фотоальбом', author: '', bg: '', bgMobile: '' },
          chapters: [],
        });
        this.store.setActiveBook(albumBookId);
        this._pendingBookId = albumBookId;
        this._render();
        this._showView('album');
        this.chapters._album.openInView();
        break;
      }
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
      const isActive = t.dataset.editorTab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    this.editorPanels.forEach(p => {
      const isActive = p.dataset.editorPanel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });
  }

  // --- Утилиты ---

  /** Обновить fade-маску скроллируемых editor-tabs */
  _updateTabsScroll() {
    const el = this.editorTabsContainer;
    const hasScroll = el.scrollWidth > el.clientWidth + 1;
    const scrolledEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    this.editorTabsWrapper.classList.toggle('has-scroll', hasScroll);
    this.editorTabsWrapper.classList.toggle('scrolled-end', scrolledEnd);
  }

  /**
   * Удалить книгу, созданную через «Создать вручную», если пользователь
   * не внёс никаких изменений и вышел из редактора кнопкой «Назад».
   */
  _cleanupPendingBook() {
    if (!this._pendingBookId) return;

    const bookId = this._pendingBookId;
    this._pendingBookId = null;

    // Проверить, осталась ли книга в исходном состоянии
    const chapters = this.store.getChapters();
    const cover = this.store.getCover();
    const isUnchanged = chapters.length === 0
      && (cover.title === 'Новая книга' || cover.title === 'Фотоальбом')
      && !cover.author;

    if (isUnchanged) {
      this.store.removeBook(bookId);
      this._render();
    }
  }

  /**
   * Стилизованный диалог подтверждения (замена native confirm()).
   * @param {string} message — текст вопроса
   * @param {Object} [opts]
   * @param {string} [opts.title='Подтверждение'] — заголовок
   * @param {string} [opts.okText='Удалить'] — текст кнопки подтверждения
   * @returns {Promise<boolean>}
   */
  _confirm(message, { title = 'Подтверждение', okText = 'Удалить' } = {}) {
    this.confirmTitle.textContent = title;
    this.confirmMessage.textContent = message;
    this.confirmOk.textContent = okText;

    return new Promise((resolve) => {
      const cleanup = () => {
        this.confirmOk.removeEventListener('click', onOk);
        this.confirmCancel.removeEventListener('click', onCancel);
        this.confirmDialog.removeEventListener('close', onClose);
      };
      const onOk = () => { cleanup(); this.confirmDialog.close(); resolve(true); };
      const onCancel = () => { cleanup(); this.confirmDialog.close(); resolve(false); };
      const onClose = () => { cleanup(); resolve(false); };

      this.confirmOk.addEventListener('click', onOk);
      this.confirmCancel.addEventListener('click', onCancel);
      this.confirmDialog.addEventListener('close', onClose);

      this.confirmDialog.showModal();
    });
  }

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
