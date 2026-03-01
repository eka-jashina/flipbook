/**
 * ACCOUNT SCREEN
 *
 * Личный кабинет (/account) — единый SPA-экран, заменяющий admin.html.
 * Оборачивает AdminApp-логику: 4 вкладки (Книги, Профиль, Настройки, Экспорт).
 *
 * Инициализация:
 *   const { AccountScreen } = await import('./core/AccountScreen.js');
 *   const screen = new AccountScreen({ apiClient, router, currentUser });
 *   await screen.init();
 *   screen.show(tab, { editBookId });
 *
 * Вкладки:
 *   1. Книги       — полный функционал из admin (BookUploadManager, editor tabs)
 *   2. Профиль     — username, displayName, bio, аватар
 *   3. Настройки   — Platform Settings (видимость, шрифты, лимиты)
 *   4. Экспорт     — Config export/import
 */

import { ServerAdminConfigStore } from '../admin/ServerAdminConfigStore.js';
import { AdminConfigStore } from '../admin/AdminConfigStore.js';
import { ChaptersModule } from '../admin/modules/ChaptersModule.js';
import { SettingsModule } from '../admin/modules/SettingsModule.js';
import { SoundsModule } from '../admin/modules/SoundsModule.js';
import { AmbientsModule } from '../admin/modules/AmbientsModule.js';
import { AppearanceModule } from '../admin/modules/AppearanceModule.js';
import { FontsModule } from '../admin/modules/FontsModule.js';
import { ExportModule } from '../admin/modules/ExportModule.js';
import { renderModeCards } from '../admin/modeCardsData.js';

// Динамический импорт CSS админки
import('../../css/admin/index.css');

export class AccountScreen {
  /**
   * @param {Object} options
   * @param {import('../utils/ApiClient.js').ApiClient} options.apiClient
   * @param {import('../utils/Router.js').Router} options.router
   * @param {Object} options.currentUser - Текущий авторизованный пользователь
   */
  constructor({ apiClient, router, currentUser }) {
    this._api = apiClient;
    this._router = router;
    this._currentUser = currentUser;
    this._store = null;
    this._initialized = false;

    // Модули (инициализируются в init)
    this.chapters = null;
    this.settings = null;
    this.sounds = null;
    this.ambients = null;
    this.appearance = null;
    this.fonts = null;
    this.export = null;
    this._profile = null;
    this._modules = [];

    // Таймеры
    this._toastTimer = null;
    this._saveIndicatorTimer = null;
    /** ID книги, созданной через «Создать вручную» (ещё не подтверждённой) */
    this._pendingBookId = null;

    // DOM-контейнер
    this.container = document.getElementById('account-screen');
  }

  /**
   * Инициализировать: создать store, модули, привязать события.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Создать store
    if (this._api) {
      try {
        this._store = await ServerAdminConfigStore.create(this._api);
      } catch {
        // Fallback
      }
    }
    if (!this._store) {
      this._store = await AdminConfigStore.create();
    }

    // Expose store для модулей (совместимость с BaseModule через app.store)
    this.store = this._store;

    // Подписка на сохранения store
    this.store.onSave = () => this._showSaveIndicator();
    if (this.store.onError !== undefined) {
      this.store.onError = (message) => {
        this._showToast(message, 'error');
        this._showSaveError();
      };
    }

    // Инициализация модулей (порядок важен — модули ожидают app с store)
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

    // Динамический импорт ProfileModule
    const { ProfileModule } = await import('../admin/modules/ProfileModule.js');
    this._profile = new ProfileModule(this);

    this._cacheDOM();
    this._bindEvents();
    this._bindPublishEvents();
    this._render();
  }

  /**
   * Показать экран кабинета.
   * @param {string} [tab='books'] - Вкладка для открытия
   * @param {Object} [options]
   * @param {string} [options.editBookId] - Если задан, открыть редактор этой книги
   * @param {string} [options.mode] - Режим (upload/manual/album)
   */
  show(tab = 'books', { editBookId, mode } = {}) {
    this.container.hidden = false;
    document.body.dataset.screen = 'account';

    this._switchTab(tab);

    if (editBookId) {
      this.store.setActiveBook(editBookId);
      this._render();
      this.openEditor();
    } else if (mode) {
      this._switchTab('books');
      this._handleModeSelect(mode);
    }
  }

  /**
   * Скрыть экран.
   */
  hide() {
    this.container.hidden = true;
  }

  /**
   * Очистка.
   */
  destroy() {
    if (this._profile) {
      this._profile.destroy();
      this._profile = null;
    }
    this._removeListeners();
    this._initialized = false;
    this._store = null;
    this.store = null;
    this._modules = [];
  }

  // ═══════════════════════════════════════════
  // DOM
  // ═══════════════════════════════════════════

  _cacheDOM() {
    const c = this.container;

    // Табы верхнего уровня
    this.tabs = c.querySelectorAll('.admin-tab');
    this.panels = c.querySelectorAll('.admin-panel');

    // Экраны (вью) внутри таба «Мои книги»
    this.screenViews = c.querySelectorAll('.screen-view');

    // Табы редактора книги
    this.editorTabsWrapper = c.querySelector('#editorTabsWrapper');
    this.editorTabsContainer = c.querySelector('#editorTabs');
    this.editorTabs = c.querySelectorAll('.editor-tab');
    this.editorPanels = c.querySelectorAll('.editor-panel');
    this.editorTitle = c.querySelector('#editorTitle');

    // Кнопки навигации
    this.addBookBtn = c.querySelector('#addBookBtn');
    this.modeSelectorBack = c.querySelector('#modeSelectorBack');
    this.uploadBack = c.querySelector('#uploadBack');
    this.editorBack = c.querySelector('#editorBack');
    this.albumBack = c.querySelector('#albumBack');

    // Карточки режимов
    this.modeCardsContainer = c.querySelector('#modeCards');
    renderModeCards(this.modeCardsContainer);

    // Toast
    this.toast = c.querySelector('#toast');
    this.toastMessage = c.querySelector('#toastMessage');
    this.toastIconPath = c.querySelector('#toastIconPath');

    // Save indicator
    this.saveIndicator = c.querySelector('#saveIndicator');
    this.saveIndicatorText = c.querySelector('#saveIndicatorText');

    // Confirm dialog
    this.confirmDialog = c.querySelector('#confirmDialog');
    this.confirmTitle = c.querySelector('#confirmTitle');
    this.confirmMessage = c.querySelector('#confirmMessage');
    this.confirmOk = c.querySelector('#confirmOk');
    this.confirmCancel = c.querySelector('#confirmCancel');

    // DOM для модулей
    this._modules.forEach(m => m.cacheDOM());

    // Profile module
    if (this._profile) this._profile.cacheDOM();
  }

  // ═══════════════════════════════════════════
  // Привязка событий
  // ═══════════════════════════════════════════

  _bindEvents() {
    // Сохраняем bound-функции для cleanup
    this._boundHandlers = {};

    // Табы верхнего уровня
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // Навигация по экранам
    this.addBookBtn.addEventListener('click', () => this._showView('mode-selector'));
    this.modeSelectorBack.addEventListener('click', () => this._showView('bookshelf'));
    this.uploadBack.addEventListener('click', () => this._showView('mode-selector'));
    this.editorBack.addEventListener('click', async () => {
      await this._cleanupPendingBook();
      this._showView('bookshelf');
    });
    this.albumBack.addEventListener('click', () => {
      this.chapters._album._cancelAlbum();
    });

    // Карточки выбора режима
    this.modeCardsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (card) this._handleModeSelect(card.dataset.mode);
    });

    // Табы редактора
    this.editorTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchEditorTab(tab.dataset.editorTab));
    });

    // Индикация скролла для editor-tabs
    this._updateTabsScroll();
    this._boundHandlers.editorScroll = () => this._updateTabsScroll();
    this._boundHandlers.resize = () => this._updateTabsScroll();
    this.editorTabsContainer.addEventListener('scroll', this._boundHandlers.editorScroll);
    window.addEventListener('resize', this._boundHandlers.resize);

    // Кнопка «На полку» (data-route обрабатывается роутером)
    const toShelfLink = this.container.querySelector('#accountToShelf');
    if (toShelfLink) {
      toShelfLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._cleanupPendingBook();
        if (this._router) {
          this._router.navigate('/');
        }
      });
    }

    // События модулей
    this._modules.forEach(m => m.bindEvents());

    // Profile module
    if (this._profile) this._profile.bindEvents();
  }

  _removeListeners() {
    if (this._boundHandlers) {
      if (this._boundHandlers.editorScroll && this.editorTabsContainer) {
        this.editorTabsContainer.removeEventListener('scroll', this._boundHandlers.editorScroll);
      }
      if (this._boundHandlers.resize) {
        window.removeEventListener('resize', this._boundHandlers.resize);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Рендер
  // ═══════════════════════════════════════════

  _render() {
    this._modules.forEach(m => m.render());
    if (this._profile) this._profile.render();
  }

  _renderJsonPreview() {
    this.export.renderJsonPreview();
  }

  // ═══════════════════════════════════════════
  // Табы верхнего уровня
  // ═══════════════════════════════════════════

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

    if (tabName === 'profile' && this._profile) {
      this._profile.render();
    }
  }

  // ═══════════════════════════════════════════
  // Навигация по экранам (вью)
  // ═══════════════════════════════════════════

  _showView(viewName) {
    this.screenViews.forEach(v => {
      const isActive = v.dataset.view === viewName;
      v.classList.toggle('active', isActive);
      v.hidden = !isActive;
    });
  }

  async _handleModeSelect(mode) {
    switch (mode) {
      case 'upload':
        this._showView('upload');
        break;
      case 'edit': {
        this._render();
        await this.openEditor();
        break;
      }
      case 'manual': {
        const created = await this.store.addBook({
          id: `book_${Date.now()}`,
          cover: { title: 'Новая книга', author: '', bg: '', bgMobile: '' },
          chapters: [],
        });
        const bookId = created?.id || `book_${Date.now()}`;
        this.store.setActiveBook(bookId);
        this._pendingBookId = bookId;
        this._render();
        await this.openEditor();
        break;
      }
      case 'album': {
        const albumCreated = await this.store.addBook({
          id: `book_${Date.now()}`,
          cover: { title: 'Фотоальбом', author: '', bg: '', bgMobile: '' },
          chapters: [],
        });
        const albumBookId = albumCreated?.id || `book_${Date.now()}`;
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
  async openEditor() {
    const cover = await this.store.getCover();
    this.editorTitle.textContent = cover.title || 'Редактор книги';
    this._switchEditorTab('cover');
    this._showView('editor');
  }

  // ═══════════════════════════════════════════
  // Табы редактора
  // ═══════════════════════════════════════════

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

    // При переходе на вкладку публикации — подгрузить данные
    if (tabName === 'publish') {
      this._renderPublishTab();
    }
  }

  // ═══════════════════════════════════════════
  // Публикация книги (вкладка Publish)
  // ═══════════════════════════════════════════

  _bindPublishEvents() {
    const c = this.container;

    this._publishVisibility = c.querySelector('#publishVisibility');
    this._bookDescription = c.querySelector('#bookDescription');
    this._descCharCount = c.querySelector('#descCharCount');
    this._shareSection = c.querySelector('#shareSection');
    this._shareLink = c.querySelector('#shareLink');
    this._copyShareLinkBtn = c.querySelector('#copyShareLink');
    this._savePublishBtn = c.querySelector('#savePublish');

    // Счётчик символов описания
    this._bookDescription.addEventListener('input', () => {
      this._descCharCount.textContent = this._bookDescription.value.length;
    });

    // Копировать ссылку
    this._copyShareLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(this._shareLink.value).then(() => {
        this._showToast('Ссылка скопирована', 'success');
      }).catch(() => {
        // Fallback
        this._shareLink.select();
        document.execCommand('copy');
        this._showToast('Ссылка скопирована', 'success');
      });
    });

    // Сохранить публикацию
    this._savePublishBtn.addEventListener('click', () => this._savePublish());
  }

  /** Заполнить вкладку «Публикация» данными текущей книги */
  async _renderPublishTab() {
    const activeBookId = this.store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    try {
      const book = await this._api.getBook(activeBookId);
      const visibility = book.visibility || 'draft';
      const description = book.description || '';

      // Видимость
      const radio = this._publishVisibility.querySelector(`input[value="${visibility}"]`);
      if (radio) radio.checked = true;

      // Описание
      this._bookDescription.value = description;
      this._descCharCount.textContent = description.length;

      // Ссылка для шаринга
      if (visibility !== 'draft') {
        this._shareSection.hidden = false;
        const base = location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        this._shareLink.value = `${base}/book/${activeBookId}`;
      } else {
        this._shareSection.hidden = true;
      }
    } catch {
      // Книга не найдена или ошибка — игнорируем
    }
  }

  async _savePublish() {
    const activeBookId = this.store.getActiveBookId?.() ?? null;
    if (!activeBookId || !this._api) return;

    const selected = this._publishVisibility.querySelector('input[name="bookVisibility"]:checked');
    const visibility = selected?.value || 'draft';
    const description = this._bookDescription.value.trim();

    try {
      await this._api.updateBook(activeBookId, { visibility, description });
      this._showToast('Настройки публикации сохранены', 'success');

      // Обновить ссылку для шаринга
      if (visibility !== 'draft') {
        this._shareSection.hidden = false;
        const base = location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        this._shareLink.value = `${base}/book/${activeBookId}`;
      } else {
        this._shareSection.hidden = true;
      }
    } catch (err) {
      this._showToast(err.message || 'Ошибка сохранения', 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Утилиты
  // ═══════════════════════════════════════════

  /** Обновить fade-маску скроллируемых editor-tabs */
  _updateTabsScroll() {
    const el = this.editorTabsContainer;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth + 1;
    const scrolledEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    this.editorTabsWrapper.classList.toggle('has-scroll', hasScroll);
    this.editorTabsWrapper.classList.toggle('scrolled-end', scrolledEnd);
  }

  /**
   * Удалить книгу, созданную через «Создать вручную», если пользователь
   * не внёс никаких изменений.
   */
  async _cleanupPendingBook() {
    if (!this._pendingBookId) return;

    const bookId = this._pendingBookId;
    this._pendingBookId = null;

    const chapters = await this.store.getChapters();
    const cover = await this.store.getCover();
    const isUnchanged = chapters.length === 0
      && (cover.title === 'Новая книга' || cover.title === 'Фотоальбом')
      && !cover.author;

    if (isUnchanged) {
      await this.store.removeBook(bookId);
      this._render();
    }
  }

  /**
   * Стилизованный диалог подтверждения.
   * @param {string} message
   * @param {Object} [opts]
   * @param {string} [opts.title='Подтверждение']
   * @param {string} [opts.okText='Удалить']
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

  /** Показать индикатор «Сохранено» */
  _showSaveIndicator() {
    const editorView = this.container.querySelector('.screen-view[data-view="editor"]');
    if (!editorView || !editorView.classList.contains('active')) return;

    this.saveIndicator.classList.remove('fade-out', 'save-indicator--error');
    this.saveIndicator.classList.add('visible');
    this.saveIndicatorText.textContent = 'Сохранено';
    this.saveIndicator.classList.add('save-indicator--saved');
    this.saveIndicator.classList.remove('save-indicator--saving');

    clearTimeout(this._saveIndicatorTimer);
    this._saveIndicatorTimer = setTimeout(() => {
      this.saveIndicator.classList.add('fade-out');
      setTimeout(() => {
        this.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--saved');
      }, 500);
    }, 2000);
  }

  /** Показать ошибку сохранения */
  _showSaveError() {
    this.saveIndicator.classList.remove('fade-out', 'save-indicator--saved', 'save-indicator--saving');
    this.saveIndicator.classList.add('visible', 'save-indicator--error');
    this.saveIndicatorText.textContent = 'Ошибка сохранения';

    clearTimeout(this._saveIndicatorTimer);
    this._saveIndicatorTimer = setTimeout(() => {
      this.saveIndicator.classList.add('fade-out');
      setTimeout(() => {
        this.saveIndicator.classList.remove('visible', 'fade-out', 'save-indicator--error');
      }, 500);
    }, 4000);
  }

  /** SVG-пути иконок для типов toast */
  static TOAST_ICONS = {
    success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  };

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'} [type]
   */
  _showToast(message, type) {
    this.toastMessage.textContent = message;
    this.toast.hidden = false;

    if (type && AccountScreen.TOAST_ICONS[type]) {
      this.toast.dataset.type = type;
      this.toastIconPath.setAttribute('d', AccountScreen.TOAST_ICONS[type]);
    } else {
      delete this.toast.dataset.type;
    }

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
