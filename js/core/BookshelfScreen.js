/**
 * BOOKSHELF SCREEN
 *
 * Экран книжного шкафа — стартовая страница приложения.
 * Показывает все книги из конфигурации на деревянных полках.
 * Пользователь выбирает книгу → она становится активной → ридер загружается.
 * Содержит кнопку «Добавить книгу» для перехода в личный кабинет.
 */

const ADMIN_CONFIG_KEY = 'flipbook-admin-config';
const BOOKS_PER_SHELF = 5;

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
  }

  /**
   * Отрендерить книжный шкаф
   */
  render() {
    if (!this.books.length) {
      this.container.innerHTML = this._renderEmpty();
      this.container.addEventListener('click', this._boundHandleClick);
      return;
    }

    // Разбиваем книги по полкам
    const shelves = [];
    for (let i = 0; i < this.books.length; i += BOOKS_PER_SHELF) {
      shelves.push(this.books.slice(i, i + BOOKS_PER_SHELF));
    }

    this.container.innerHTML = `
      <div class="bookshelf-header">
        <h1 class="bookshelf-title">Книжная полка</h1>
        <span class="bookshelf-subtitle">${this.books.length} ${this._pluralize(this.books.length)}</span>
      </div>
      <div class="bookshelf-shelves">
        ${shelves.map(shelf => this._renderShelf(shelf)).join('')}
      </div>
      <div class="bookshelf-actions">
        <a href="admin.html" class="bookshelf-add-btn" aria-label="Добавить книгу">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Добавить книгу
        </a>
      </div>
    `;

    this.container.addEventListener('click', this._boundHandleClick);
  }

  /**
   * Показать экран
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
    this.container.removeEventListener('click', this._boundHandleClick);
    this.container.innerHTML = '';
  }

  // ═══════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════

  /**
   * Рендер одной полки с книгами
   * @private
   */
  _renderShelf(books) {
    return `
      <div class="bookshelf-shelf">
        <div class="bookshelf-books">
          ${books.map(book => this._renderBook(book)).join('')}
        </div>
        <div class="bookshelf-plank"></div>
      </div>
    `;
  }

  /**
   * Рендер одной книги
   * @private
   */
  _renderBook(book) {
    const title = this._escapeHtml(book.cover?.title || 'Без названия');
    const author = this._escapeHtml(book.cover?.author || '');
    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';

    // Если есть фоновое изображение обложки — используем его
    const coverBgImage = book.appearance?.light?.coverBgImage;
    let backgroundStyle = `background: linear-gradient(135deg, ${bgStart}, ${bgEnd});`;
    if (coverBgImage) {
      backgroundStyle = `background: linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${coverBgImage}') center/cover;`;
    }

    return `
      <button
        class="bookshelf-book"
        data-book-id="${this._escapeHtml(book.id)}"
        aria-label="Открыть книгу: ${title}"
        type="button"
      >
        <div
          class="bookshelf-book-cover"
          style="${backgroundStyle} color: ${textColor};"
        >
          <div class="bookshelf-book-frame"></div>
          <span class="bookshelf-book-title">${title}</span>
          ${author ? `<span class="bookshelf-book-author">${author}</span>` : ''}
        </div>
        <div class="bookshelf-book-shadow"></div>
      </button>
    `;
  }

  /**
   * Рендер пустого состояния
   * @private
   */
  _renderEmpty() {
    return `
      <div class="bookshelf-header">
        <h1 class="bookshelf-title">Книжная полка</h1>
      </div>
      <div class="bookshelf-empty">
        <div class="bookshelf-empty-icon">📚</div>
        <div class="bookshelf-empty-text">
          Книги пока не добавлены
        </div>
        <a href="admin.html" class="bookshelf-add-btn" aria-label="Добавить книгу">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Добавить книгу
        </a>
      </div>
    `;
  }

  /**
   * Обработка клика по книге
   * @private
   */
  _handleClick(e) {
    const bookBtn = e.target.closest('.bookshelf-book');
    if (!bookBtn) return;

    const bookId = bookBtn.dataset.bookId;
    if (!bookId) return;

    // Сохраняем выбранную книгу в админ-конфиг
    this._saveActiveBook(bookId);

    if (this.onBookSelect) {
      this.onBookSelect(bookId);
    }
  }

  /**
   * Сохранить activeBookId в localStorage
   * @private
   */
  _saveActiveBook(bookId) {
    try {
      const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
      if (!raw) return;

      const config = JSON.parse(raw);
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

  /**
   * Экранирование HTML
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, c => map[c]);
  }
}

/**
 * Проверить, нужно ли показывать книжный шкаф
 * @returns {{ shouldShow: boolean, books: Array }}
 */
export function getBookshelfData() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (!raw) return { shouldShow: true, books: [] };

    const config = JSON.parse(raw);
    const books = Array.isArray(config.books) ? config.books : [];

    // Показываем шкаф если нет activeBookId (пользователь ещё не выбрал книгу)
    const hasActiveBook = !!config.activeBookId;

    return {
      shouldShow: !hasActiveBook,
      books,
    };
  } catch {
    return { shouldShow: true, books: [] };
  }
}

/**
 * Очистить выбор активной книги (вернуться к полке)
 */
export function clearActiveBook() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
    if (!raw) return;

    const config = JSON.parse(raw);
    delete config.activeBookId;
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* повреждённые данные — игнорируем */
  }
}
