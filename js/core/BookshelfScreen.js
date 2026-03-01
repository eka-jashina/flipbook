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
 */

import { ProfileHeader } from './ProfileHeader.js';

const ADMIN_CONFIG_KEY = 'flipbook-admin-config';
const BOOKS_PER_SHELF = 5;

/** Метки видимости книг */
const VISIBILITY_LABELS = {
  draft: 'Черновик',
  unlisted: 'По ссылке',
  published: 'Опубликована',
};

/** Циклическое переключение видимости */
const VISIBILITY_NEXT = {
  draft: 'published',
  published: 'unlisted',
  unlisted: 'draft',
};

// Дефолтная книга для полки (когда нет конфига)
const DEFAULT_BOOKSHELF_BOOK = {
  id: 'default',
  title: 'О хоббитах',
  author: 'Дж.Р.Р.Толкин',
  appearance: {
    light: {
      coverBgStart: '#3a2d1f',
      coverBgEnd: '#2a2016',
      coverText: '#f2e9d8',
    },
  },
};

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
   * @param {import('../utils/Router.js').Router} [options.router] - SPA-роутер
   */
  constructor({ container, books, onBookSelect, apiClient, mode = 'owner', profileUser, onEditProfile, router }) {
    this.container = container;
    this.books = books;
    this.onBookSelect = onBookSelect;
    this._api = apiClient || null;
    this._mode = mode;
    this._profileUser = profileUser || null;
    this._onEditProfile = onEditProfile;
    this._router = router || null;
    this._boundHandleClick = this._handleClick.bind(this);
    this._boundCloseMenu = this._closeBookMenu.bind(this);
    this._currentView = 'shelf';
    this._openMenuBookId = null;
    this._profileHeader = null;

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
        // Пустое состояние (только owner)
        if (shelves) shelves.hidden = true;
        if (actions) actions.hidden = true;
        if (empty) empty.hidden = false;
        if (subtitle) subtitle.textContent = '';
      } else {
        // Guest: пустая полка — показываем сообщение
        if (shelves) shelves.hidden = true;
        if (subtitle) subtitle.textContent = 'Книг пока нет';
      }
    } else {
      // Есть книги — показать полки
      if (empty) empty.hidden = true;
      if (shelves) {
        shelves.hidden = false;
        shelves.innerHTML = '';

        // Разбиваем книги по полкам
        for (let i = 0; i < this.books.length; i += BOOKS_PER_SHELF) {
          const chunk = this.books.slice(i, i + BOOKS_PER_SHELF);
          shelves.appendChild(this._createShelf(chunk));
        }
      }
      if (isOwner && actions) actions.hidden = false;
      if (header) header.hidden = false;
      if (subtitle) {
        subtitle.textContent = `${this.books.length} ${this._pluralize(this.books.length)}`;
      }
    }

    this.container.addEventListener('click', this._boundHandleClick);
  }

  /**
   * Показать экран
   */
  show() {
    if ('startViewTransition' in document) {
      document.documentElement.dataset.vt = 'to-shelf';
      const t = document.startViewTransition(() => {
        this.container.hidden = false;
        document.body.dataset.screen = 'bookshelf';
      });
      t.finished.finally(() => delete document.documentElement.dataset.vt);
    } else {
      this.container.hidden = false;
      document.body.dataset.screen = 'bookshelf';
    }
  }

  /**
   * Скрыть экран
   */
  hide() {
    if ('startViewTransition' in document) {
      document.documentElement.dataset.vt = 'to-reader';
      const t = document.startViewTransition(() => {
        document.body.dataset.screen = 'reader';
      });
      t.finished.finally(() => delete document.documentElement.dataset.vt);
    } else {
      document.body.dataset.screen = 'reader';
    }
  }

  /**
   * Очистка
   */
  destroy() {
    this._closeBookMenu();
    this.container.removeEventListener('click', this._boundHandleClick);
    // Очищаем только динамический контент (полки с книгами)
    if (this._els.shelves) this._els.shelves.innerHTML = '';
    if (this._profileHeader) {
      this._profileHeader.destroy();
      this._profileHeader = null;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE — Рендеринг через <template>
  // ═══════════════════════════════════════════

  /**
   * Создать одну полку с книгами из шаблона
   * @private
   * @param {Array} books
   * @returns {DocumentFragment}
   */
  _createShelf(books) {
    const tmpl = document.getElementById('tmpl-bookshelf-shelf');
    const frag = tmpl.content.cloneNode(true);
    const booksContainer = frag.querySelector('.bookshelf-books');

    for (const book of books) {
      booksContainer.appendChild(this._createBook(book));
    }

    return frag;
  }

  /**
   * Создать карточку книги из шаблона.
   * Поддерживает оба формата: localStorage (cover.title) и API (title).
   * @private
   * @param {Object} book
   * @returns {DocumentFragment}
   */
  _createBook(book) {
    const tmpl = document.getElementById('tmpl-bookshelf-book');
    const frag = tmpl.content.cloneNode(true);
    const isOwner = this._mode === 'owner';

    // Поддержка обоих форматов: API (title/author на верхнем уровне) и localStorage (cover.title/cover.author)
    const title = book.title || book.cover?.title || 'Без названия';
    const author = book.author || book.cover?.author || '';
    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';
    const coverBgImage = book.appearance?.light?.coverBgImage || book.appearance?.light?.coverBgImageUrl;
    const visibility = book.visibility || 'draft';

    // Wrapper
    const wrapper = frag.querySelector('.bookshelf-book-wrapper');
    wrapper.dataset.bookId = book.id;

    // Visibility class (only in owner mode)
    if (isOwner && visibility !== 'published') {
      wrapper.classList.add(`bookshelf-book--${visibility}`);
    }

    // Button
    const btn = frag.querySelector('.bookshelf-book');
    btn.dataset.bookId = book.id;
    btn.setAttribute('aria-label', `Открыть книгу: ${title}`);

    // Cover
    const cover = frag.querySelector('.bookshelf-book-cover');
    if (coverBgImage) {
      cover.style.background = `linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${coverBgImage}') center/cover`;
    } else {
      cover.style.background = `linear-gradient(135deg, ${bgStart}, ${bgEnd})`;
    }
    cover.style.color = textColor;

    // Visibility badge (only in owner mode for non-published)
    const badge = frag.querySelector('.bookshelf-book-badge');
    if (isOwner && visibility !== 'published' && badge) {
      badge.textContent = VISIBILITY_LABELS[visibility] || visibility;
      badge.hidden = false;
    }

    // Title & author
    frag.querySelector('.bookshelf-book-title').textContent = title;
    const authorEl = frag.querySelector('.bookshelf-book-author');
    if (author) {
      authorEl.textContent = author;
    } else {
      authorEl.remove();
    }

    // Menu items
    if (isOwner) {
      // Проставить data-book-id на все пункты меню
      const menuItems = frag.querySelectorAll('[data-book-action]');
      menuItems.forEach(item => {
        item.dataset.bookId = book.id;
      });
      // Обновить label видимости
      const visLabel = frag.querySelector('[data-visibility-label]');
      if (visLabel) {
        const nextVis = VISIBILITY_NEXT[visibility];
        visLabel.textContent = VISIBILITY_LABELS[nextVis] ? `Сделать: ${VISIBILITY_LABELS[nextVis].toLowerCase()}` : 'Видимость';
      }
    } else {
      // Guest mode: удалить контекстное меню
      const menu = frag.querySelector('.bookshelf-book-menu');
      if (menu) menu.remove();
    }

    return frag;
  }

  // ═══════════════════════════════════════════
  // PRIVATE — Навигация и меню
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
        this._router.navigate('/account');
      }
      return;
    }

    // Действие из контекстного меню книги (только owner)
    const menuItem = e.target.closest('[data-book-action]');
    if (menuItem && this._mode === 'owner') {
      const action = menuItem.dataset.bookAction;
      const bookId = menuItem.dataset.bookId;
      this._closeBookMenu();
      this._handleBookAction(action, bookId);
      return;
    }

    // Клик по книге
    const bookBtn = e.target.closest('.bookshelf-book');
    if (bookBtn) {
      const bookId = bookBtn.dataset.bookId;
      if (!bookId) return;

      if (this._mode === 'guest') {
        // Guest mode: сразу переход к чтению
        if (this.onBookSelect) this.onBookSelect(bookId);
      } else {
        // Owner mode: открыть контекстное меню
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
   * Открыть меню книги
   * @private
   */
  _openBookMenu(bookId) {
    // Закрыть предыдущее меню
    if (this._openMenuBookId) {
      this._closeBookMenu();
    }

    const wrapper = this.container.querySelector(`.bookshelf-book-wrapper[data-book-id="${bookId}"]`);
    if (!wrapper) return;

    const menu = wrapper.querySelector('.bookshelf-book-menu');
    if (!menu) return;

    wrapper.classList.add('menu-open');
    menu.hidden = false;
    this._openMenuBookId = bookId;

    // Закрыть по клику снаружи (с задержкой, чтобы текущий клик не сработал)
    setTimeout(() => {
      document.addEventListener('click', this._boundCloseMenu);
    }, 0);
  }

  /**
   * Закрыть меню книги
   * @private
   */
  _closeBookMenu() {
    if (!this._openMenuBookId) return;

    const wrapper = this.container.querySelector(`.bookshelf-book-wrapper[data-book-id="${this._openMenuBookId}"]`);
    if (wrapper) {
      wrapper.classList.remove('menu-open');
      const menu = wrapper.querySelector('.bookshelf-book-menu');
      if (menu) menu.hidden = true;
    }

    this._openMenuBookId = null;
    document.removeEventListener('click', this._boundCloseMenu);
  }

  /**
   * Обработка действия с книгой
   * @private
   */
  _handleBookAction(action, bookId) {
    switch (action) {
      case 'read':
        if (this.onBookSelect) this.onBookSelect(bookId);
        break;

      case 'edit':
        if (this._router) {
          this._router.navigate(`/account?edit=${bookId}`);
        }
        break;

      case 'visibility':
        this._toggleVisibility(bookId);
        break;

      case 'delete':
        this._deleteBook(bookId);
        break;
    }
  }

  /**
   * Переключить видимость книги (draft → published → unlisted → draft)
   * @private
   */
  async _toggleVisibility(bookId) {
    const book = this.books.find(b => b.id === bookId);
    if (!book) return;

    const currentVis = book.visibility || 'draft';
    const nextVis = VISIBILITY_NEXT[currentVis] || 'draft';

    if (this._api) {
      try {
        await this._api.updateBook(bookId, { visibility: nextVis });
        book.visibility = nextVis;
        // Перерисовать полку
        this.container.removeEventListener('click', this._boundHandleClick);
        this.render();
      } catch (err) {
        console.error('Ошибка смены видимости:', err);
      }
    }
  }

  /**
   * Удалить книгу с полки
   * @private
   */
  async _deleteBook(bookId) {
    const book = this.books.find(b => b.id === bookId);
    const title = book?.title || book?.cover?.title || 'эту книгу';

    if (!confirm(`Удалить «${title}»?`)) return;

    if (this._api) {
      try {
        await this._api.deleteBook(bookId);
      } catch (err) {
        console.error('Ошибка удаления книги:', err);
        return;
      }
    } else {
      // Fallback: localStorage
      try {
        const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
        if (raw) {
          const config = JSON.parse(raw);
          config.books = (config.books || []).filter(b => b.id !== bookId);
          if (config.activeBookId === bookId) delete config.activeBookId;
          localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
        }
      } catch { /* игнорируем */ }
    }

    // Обновляем массив и перерисовываем
    this.books = this.books.filter(b => b.id !== bookId);
    this.container.removeEventListener('click', this._boundHandleClick);
    this.render();
  }

  /**
   * Склонение слова "книга"
   * @private
   */
  _pluralize(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'книга';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'книги';
    return 'книг';
  }
}

/**
 * Загрузить книги из API для bookshelf
 * @param {import('../utils/ApiClient.js').ApiClient} apiClient
 * @returns {Promise<Array>} Массив книг
 */
export async function loadBooksFromAPI(apiClient) {
  const books = await apiClient.getBooks();
  return books;
}

/**
 * Проверить, нужно ли показывать книжный шкаф (localStorage fallback)
 * @returns {{ shouldShow: boolean, books: Array }}
 */
export function getBookshelfData() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (!raw) return { books: [DEFAULT_BOOKSHELF_BOOK] };

    const config = JSON.parse(raw);
    const books = Array.isArray(config.books) && config.books.length
      ? config.books
      : [DEFAULT_BOOKSHELF_BOOK];

    return { books };
  } catch {
    return { books: [DEFAULT_BOOKSHELF_BOOK] };
  }
}

/**
 * Очистить выбор активной книги (вернуться к полке)
 */
export function clearActiveBook() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (raw) {
      const config = JSON.parse(raw);
      delete config.activeBookId;
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
    }
  } catch {
    /* повреждённые данные — игнорируем */
  }
}
