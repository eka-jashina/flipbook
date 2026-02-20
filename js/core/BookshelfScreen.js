/**
 * BOOKSHELF SCREEN
 *
 * Экран книжного шкафа — стартовая страница приложения.
 * Показывает все книги из конфигурации на деревянных полках.
 * Пользователь выбирает книгу → она становится активной → ридер загружается.
 *
 * Статическая разметка (header, actions, empty, mode-selector) определена в index.html.
 * Динамические элементы (полки, карточки книг) клонируются из <template>.
 */

const ADMIN_CONFIG_KEY = 'flipbook-admin-config';
const READING_SESSION_KEY = 'flipbook-reading-session';
const BOOKS_PER_SHELF = 5;

// Дефолтная книга для полки (когда нет конфига в localStorage)
const DEFAULT_BOOKSHELF_BOOK = {
  id: 'default',
  cover: {
    title: 'О хоббитах',
    author: 'Дж.Р.Р.Толкин',
  },
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
   * @param {Array} options.books - Массив книг из админ-конфига
   * @param {Function} options.onBookSelect - Колбэк при выборе книги
   */
  constructor({ container, books, onBookSelect }) {
    this.container = container;
    this.books = books;
    this.onBookSelect = onBookSelect;
    this._boundHandleClick = this._handleClick.bind(this);
    this._boundCloseMenu = this._closeBookMenu.bind(this);
    this._currentView = 'shelf';
    this._openMenuBookId = null;

    // Кэш ссылок на статические элементы из HTML
    this._els = {
      shelves: container.querySelector('#bookshelf-shelves'),
      actions: container.querySelector('#bookshelf-actions'),
      empty: container.querySelector('#bookshelf-empty'),
      subtitle: container.querySelector('#bookshelf-subtitle'),
      header: container.querySelector('.bookshelf-header'),
      modeSelector: container.querySelector('#bookshelf-mode-selector'),
    };
  }

  /**
   * Отрендерить книжный шкаф
   */
  render() {
    const { shelves, actions, empty, subtitle, header, modeSelector } = this._els;

    // Сброс mode selector при рендере (важно при восстановлении из bfcache)
    if (modeSelector) modeSelector.hidden = true;
    this._currentView = 'shelf';

    if (!this.books.length) {
      // Пустое состояние
      if (shelves) shelves.hidden = true;
      if (actions) actions.hidden = true;
      if (empty) empty.hidden = false;
      if (subtitle) subtitle.textContent = '';
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
      if (actions) actions.hidden = false;
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
   * Создать карточку книги из шаблона
   * @private
   * @param {Object} book
   * @returns {DocumentFragment}
   */
  _createBook(book) {
    const tmpl = document.getElementById('tmpl-bookshelf-book');
    const frag = tmpl.content.cloneNode(true);

    const title = book.cover?.title || 'Без названия';
    const author = book.cover?.author || '';
    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';
    const coverBgImage = book.appearance?.light?.coverBgImage;

    // Wrapper
    const wrapper = frag.querySelector('.bookshelf-book-wrapper');
    wrapper.dataset.bookId = book.id;

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

    // Title & author
    frag.querySelector('.bookshelf-book-title').textContent = title;
    const authorEl = frag.querySelector('.bookshelf-book-author');
    if (author) {
      authorEl.textContent = author;
    } else {
      authorEl.remove();
    }

    // Menu items — проставить data-book-id
    const menuItems = frag.querySelectorAll('[data-book-action]');
    menuItems.forEach(item => {
      item.dataset.bookId = book.id;
    });

    return frag;
  }

  // ═══════════════════════════════════════════
  // PRIVATE — Навигация и меню
  // ═══════════════════════════════════════════

  /**
   * Показать/скрыть экран выбора режима
   * @private
   */
  _toggleModeSelector(show) {
    this._currentView = show ? 'mode-selector' : 'shelf';
    const { modeSelector, header, shelves, actions, empty } = this._els;

    if (modeSelector) modeSelector.hidden = !show;
    if (header) header.hidden = show;
    if (shelves) shelves.hidden = show;
    if (actions) actions.hidden = show;
    if (empty) empty.hidden = show || this.books.length > 0;
  }

  /**
   * Обработка кликов
   * @private
   */
  _handleClick(e) {
    // Кнопка «Создать книгу»
    const addBtn = e.target.closest('[data-action="add-book"]');
    if (addBtn) {
      e.preventDefault();
      this._toggleModeSelector(true);
      return;
    }

    // Кнопка «Назад» из mode selector
    const backBtn = e.target.closest('[data-action="back-to-shelf"]');
    if (backBtn) {
      this._toggleModeSelector(false);
      return;
    }

    // Карточка режима создания книги
    const modeCard = e.target.closest('[data-mode]');
    if (modeCard) {
      const mode = modeCard.dataset.mode;
      sessionStorage.setItem('flipbook-admin-mode', mode);
      window.location.href = `${import.meta.env.BASE_URL || '/'}admin.html`;
      return;
    }

    // Действие из контекстного меню книги
    const menuItem = e.target.closest('[data-book-action]');
    if (menuItem) {
      const action = menuItem.dataset.bookAction;
      const bookId = menuItem.dataset.bookId;
      this._closeBookMenu();
      this._handleBookAction(action, bookId);
      return;
    }

    // Клик по книге — открыть контекстное меню
    const bookBtn = e.target.closest('.bookshelf-book');
    if (bookBtn) {
      const bookId = bookBtn.dataset.bookId;
      if (bookId) this._openBookMenu(bookId);
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
        this._saveActiveBook(bookId);
        sessionStorage.setItem(READING_SESSION_KEY, '1');
        if (this.onBookSelect) this.onBookSelect(bookId);
        break;

      case 'edit':
        sessionStorage.setItem('flipbook-admin-mode', 'edit');
        sessionStorage.setItem('flipbook-admin-edit-book', bookId);
        window.location.href = `${import.meta.env.BASE_URL || '/'}admin.html`;
        break;

      case 'delete':
        this._deleteBook(bookId);
        break;
    }
  }

  /**
   * Удалить книгу с полки
   * @private
   */
  _deleteBook(bookId) {
    const book = this.books.find(b => b.id === bookId);
    const title = book?.cover?.title || 'эту книгу';

    if (!confirm(`Удалить «${title}»?`)) return;

    try {
      const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        config.books = (config.books || []).filter(b => b.id !== bookId);
        if (config.activeBookId === bookId) delete config.activeBookId;
        localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
      }
    } catch { /* игнорируем */ }

    // Обновляем массив и перерисовываем
    this.books = this.books.filter(b => b.id !== bookId);
    this.container.removeEventListener('click', this._boundHandleClick);
    this.render();
  }

  /**
   * Сохранить activeBookId в localStorage
   * @private
   */
  _saveActiveBook(bookId) {
    try {
      const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
      const config = raw ? JSON.parse(raw) : { books: [DEFAULT_BOOKSHELF_BOOK] };
      config.activeBookId = bookId;
      localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* повреждённые данные — игнорируем */
    }
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
 * Проверить, нужно ли показывать книжный шкаф
 * @returns {{ shouldShow: boolean, books: Array }}
 */
export function getBookshelfData() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (!raw) return { shouldShow: true, books: [DEFAULT_BOOKSHELF_BOOK] };

    const config = JSON.parse(raw);
    const books = Array.isArray(config.books) && config.books.length
      ? config.books
      : [DEFAULT_BOOKSHELF_BOOK];

    // Показываем шкаф если нет activeBookId или если пользователь пришёл из новой сессии
    // (sessionStorage сбрасывается при закрытии вкладки/браузера)
    const hasActiveBook = !!config.activeBookId;
    const isReadingSession = !!sessionStorage.getItem(READING_SESSION_KEY);

    return {
      shouldShow: !hasActiveBook || !isReadingSession,
      books,
    };
  } catch {
    return { shouldShow: true, books: [DEFAULT_BOOKSHELF_BOOK] };
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
  sessionStorage.removeItem(READING_SESSION_KEY);
}
