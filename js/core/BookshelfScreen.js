/**
 * BOOKSHELF SCREEN
 *
 * Экран книжного шкафа — стартовая страница для авторизованных пользователей
 * и публичная витрина для гостей.
 *
 * Два режима:
 *
 * **owner** (хозяин, /:username = текущий юзер):
 * - Все книги (draft/unlisted/published) с визуальными метками
 * - Контекстное меню: Читать / Редактировать / Видимость / Удалить
 * - Кнопка «Добавить книгу» и mode selector
 *
 * **guest** (гость, /:username ≠ текущий юзер):
 * - Только published-книги
 * - Клик → переход к ридеру (без контекстного меню)
 * - Нет кнопок управления
 *
 * Статическая разметка (header, actions, empty, mode-selector) определена в index.html.
 * Динамические элементы (полки, карточки книг) клонируются из <template>.
 *
 * Делегирует:
 *   рендеринг карточек → BookCardRenderer
 *   контекстное меню → BookContextMenu
 *   операции с книгами → BookOperations
 *   утилиты → bookshelfUtils
 */

import { ProfileHeader } from './ProfileHeader.js';
import { BookCardRenderer } from './BookCardRenderer.js';
import { BookContextMenu } from './BookContextMenu.js';
import { toggleVisibility, setVisibility, deleteBook } from './BookOperations.js';
import { getDefaultBook, formatBooksCount } from './bookshelfUtils.js';
import { adminConfigStorage } from '../config/configHelpers.js';
import { t, applyTranslations } from '@i18n';
import { trackBookOpened } from '../utils/Analytics.js';

export class BookshelfScreen {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - DOM-контейнер для шкафа
   * @param {Array} options.books - Массив книг (из API или localStorage)
   * @param {Function} options.onBookSelect - Колбэк при выборе книги (bookId)
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient] - API клиент
   * @param {'owner'|'guest'} [options.mode='owner'] - Режим отображения
   * @param {Object} [options.profileUser] - Данные профиля для шапки { username, displayName, bio }
   * @param {Function} [options.onEditProfile] - Колбэк при клике «Редактировать профиль»
   * @param {Function} [options.onLogout] - Колбэк при клике «Выйти»
   * @param {import('../utils/Router.js').Router} [options.router] - SPA-роутер
   */
  constructor({ container, books, onBookSelect, apiClient, mode = 'owner', profileUser, onEditProfile, onLogout, router }) {
    this.container = container;
    this.books = books;
    this.onBookSelect = onBookSelect;
    this._api = apiClient || null;
    this._mode = mode;
    this._profileUser = profileUser || null;
    this._onEditProfile = onEditProfile;
    this._onLogout = onLogout;
    this._router = router || null;
    this._boundHandleClick = this._handleClick.bind(this);
    this._profileHeader = null;

    // Делегаты
    this._cardRenderer = new BookCardRenderer(mode);
    this._contextMenu = new BookContextMenu(container);

    // Кэш ссылок на статические элементы из HTML
    this._els = {
      shelves: container.querySelector('#bookshelf-shelves'),
      actions: container.querySelector('#bookshelf-actions'),
      empty: container.querySelector('#bookshelf-empty'),
      subtitle: container.querySelector('#bookshelf-subtitle'),
      header: container.querySelector('.bookshelf-header'),
    };
  }

  /**
   * Отрендерить книжный шкаф
   */
  render() {
    const { shelves, actions, empty, subtitle, header } = this._els;
    const isOwner = this._mode === 'owner';

    // Профильная шапка (если задан profileUser)
    if (this._profileUser) {
      if (this._profileHeader) this._profileHeader.destroy();
      this._profileHeader = new ProfileHeader({
        user: this._profileUser,
        isOwner,
        onEditProfile: this._onEditProfile || (isOwner && this._router
          ? () => this._router.navigate('/account?tab=profile')
          : undefined),
        onLogout: isOwner ? this._onLogout : undefined,
      });
      this._profileHeader.render(this.container);
    }

    // В guest mode скрываем элементы управления
    if (!isOwner) {
      if (actions) actions.hidden = true;
      if (empty) empty.hidden = true;
    }

    if (!this.books.length) {
      if (isOwner) {
        if (shelves) shelves.hidden = true;
        if (actions) actions.hidden = true;
        if (empty) empty.hidden = false;
        if (subtitle) subtitle.textContent = '';
      } else {
        if (shelves) shelves.hidden = true;
        if (subtitle) subtitle.textContent = t('bookshelf.emptyGuest');
      }
    } else {
      if (empty) empty.hidden = true;
      if (shelves) {
        shelves.hidden = false;
        shelves.innerHTML = '';
        shelves.appendChild(this._cardRenderer.createShelves(this.books));
      }
      if (isOwner && actions) actions.hidden = false;
      if (header) header.hidden = false;
      if (subtitle) {
        subtitle.textContent = formatBooksCount(this.books.length);
      }
    }

    this.container.addEventListener('click', this._boundHandleClick);
    applyTranslations(this.container);
  }

  /**
   * Показать экран.
   * View Transitions управляются централизованно в route handlers.
   */
  show() {
    this.container.hidden = false;
    document.body.dataset.screen = 'bookshelf';
  }

  /**
   * Скрыть экран
   */
  hide() {
    document.body.dataset.screen = 'reader';
  }

  /**
   * Очистка
   */
  destroy() {
    this._closeBookMenu();
    this.container.removeEventListener('click', this._boundHandleClick);
    if (this._els.shelves) this._els.shelves.innerHTML = '';
    if (this._profileHeader) {
      this._profileHeader.destroy();
      this._profileHeader = null;
    }
    this.container.hidden = true;
  }

  // ═══════════════════════════════════════════
  // PRIVATE — Навигация и действия
  // ═══════════════════════════════════════════

  /**
   * Обработка кликов
   * @private
   */
  _handleClick(e) {
    // Кнопка «Создать книгу» (только owner) → переход в /account
    const addBtn = e.target.closest('[data-action="add-book"]');
    if (addBtn && this._mode === 'owner') {
      e.preventDefault();
      if (this._router) {
        this._router.navigate('/account?create=true');
      }
      return;
    }

    // Действие из контекстного меню книги (только owner)
    const menuItem = e.target.closest('[data-book-action]');
    if (menuItem && this._mode === 'owner') {
      const action = menuItem.dataset.bookAction;
      const bookId = menuItem.dataset.bookId;
      const visibility = menuItem.dataset.visibility;
      this._closeBookMenu();
      this._handleBookAction(action, bookId, visibility);
      return;
    }

    // Клик по книге
    const bookBtn = e.target.closest('.bookshelf-book');
    if (bookBtn) {
      const bookId = bookBtn.dataset.bookId;
      if (!bookId) return;

      if (this._mode === 'guest') {
        trackBookOpened(bookId);
        if (this.onBookSelect) this.onBookSelect(bookId);
      } else {
        this._openBookMenu(bookId);
      }
      return;
    }

    // Клик мимо меню — закрыть
    if (this._openMenuBookId) {
      this._closeBookMenu();
    }
  }

  /**
   * Обработка действия с книгой
   * @private
   */
  _handleBookAction(action, bookId, visibility) {
    switch (action) {
      case 'read':
        trackBookOpened(bookId);
        if (this.onBookSelect) this.onBookSelect(bookId);
        break;

      case 'edit':
        if (this._router) {
          this._router.navigate(`/account?edit=${bookId}`);
        }
        break;

      case 'visibility':
        this._handleToggleVisibility(bookId);
        break;

      case 'set-visibility':
        this._handleSetVisibility(bookId, visibility);
        break;

      case 'delete':
        this._deleteBook(bookId);
        break;
    }
  }

  /** @private */
  async _handleToggleVisibility(bookId) {
    const changed = await toggleVisibility(bookId, this.books, this._api);
    if (changed) {
      this.container.removeEventListener('click', this._boundHandleClick);
      this.render();
    }
  }

  /** @private */
  async _handleSetVisibility(bookId, visibility) {
    const changed = await setVisibility(bookId, visibility, this.books, this._api);
    if (changed) {
      this.container.removeEventListener('click', this._boundHandleClick);
      this.render();
    }
  }

  /** @private */
  async _handleDeleteBook(bookId) {
    const deleted = await deleteBook(bookId, this.books, this._api);
    if (deleted) {
      this.books = this.books.filter(b => b.id !== bookId);
      this.container.removeEventListener('click', this._boundHandleClick);
      this.render();
    }
  }

  // --- Прокси-методы для совместимости с тестами ---

  /** Прокси для _openMenuBookId (совместимость с тестами) */
  get _openMenuBookId() { return this._contextMenu.openBookId; }
  set _openMenuBookId(val) { this._contextMenu._openMenuBookId = val; }

  /** Прокси для _boundCloseMenu (совместимость с тестами) */
  get _boundCloseMenu() { return this._contextMenu._boundCloseMenu; }

  /** @see formatBooksCount */
  _formatBooksCount(count) { return formatBooksCount(count); }

  /** @see BookContextMenu#open */
  _openBookMenu(bookId) {
    if (this._contextMenu.openBookId) {
      this._closeBookMenu();
    }
    this._contextMenu._doOpen(bookId);
  }

  /** @see BookContextMenu#close */
  _closeBookMenu() { this._contextMenu.close(); }

  /** Удалить книгу с полки */
  async _deleteBook(bookId) {
    const book = this.books.find(b => b.id === bookId);
    const title = book?.title || book?.cover?.title || '';

    if (!confirm(t('bookshelf.deleteConfirm', { title }))) return;

    if (this._api) {
      try {
        await this._api.deleteBook(bookId);
      } catch (err) {
        console.error('Ошибка удаления книги:', err);
        return;
      }
    } else {
      // Fallback: localStorage
      const config = adminConfigStorage.load();
      if (Object.keys(config).length > 0) {
        config.books = (config.books || []).filter(b => b.id !== bookId);
        if (config.activeBookId === bookId) delete config.activeBookId;
        adminConfigStorage.setFull(config);
      }
    }

    this.books = this.books.filter(b => b.id !== bookId);
    this.container.removeEventListener('click', this._boundHandleClick);
    this.render();
  }

  /** @see toggleVisibility */
  async _toggleVisibility(bookId) { return this._handleToggleVisibility(bookId); }
}

/**
 * Загрузить книги из API для bookshelf
 * @param {import('../utils/ApiClient.js').ApiClient} apiClient
 * @returns {Promise<Array>} Массив книг
 */
export async function loadBooksFromAPI(apiClient) {
  const result = await apiClient.getBooks();
  return result.books || [];
}

/**
 * Проверить, нужно ли показывать книжный шкаф (localStorage fallback)
 * @returns {{ shouldShow: boolean, books: Array }}
 */
export function getBookshelfData() {
  const config = adminConfigStorage.load();
  if (Object.keys(config).length === 0) return { books: [getDefaultBook()] };

  const books = Array.isArray(config.books) && config.books.length
    ? config.books
    : [getDefaultBook()];

  return { books };
}

/**
 * Очистить выбор активной книги (вернуться к полке)
 */
export function clearActiveBook() {
  const config = adminConfigStorage.load();
  if (Object.keys(config).length > 0) {
    delete config.activeBookId;
    adminConfigStorage.setFull(config);
  }
}
