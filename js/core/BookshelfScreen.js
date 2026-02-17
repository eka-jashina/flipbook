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
    this._currentView = 'shelf';
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
        <button type="button" class="bookshelf-add-btn" data-action="add-book" aria-label="Создать книгу">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Создать книгу
        </button>
      </div>
      ${this._renderModeSelector()}
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
        <button type="button" class="bookshelf-add-btn" data-action="add-book" aria-label="Создать книгу">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Создать книгу
        </button>
      </div>
      ${this._renderModeSelector()}
    `;
  }

  /**
   * Рендер экрана выбора режима создания книги
   * @private
   */
  _renderModeSelector() {
    return `
      <div class="bookshelf-mode-selector" hidden>
        <div class="bookshelf-mode-header">
          <button type="button" class="bookshelf-mode-back" data-action="back-to-shelf" aria-label="Назад к полке">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Назад
          </button>
          <h2 class="bookshelf-mode-title">Как вы хотите создать книгу?</h2>
          <p class="bookshelf-mode-desc">Выберите способ — вы всегда сможете отредактировать результат</p>
        </div>
        <div class="bookshelf-mode-cards">
          <a href="admin.html?mode=upload" class="bookshelf-mode-card">
            <div class="bookshelf-mode-card-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
              </svg>
            </div>
            <div class="bookshelf-mode-card-title">Загрузить файл</div>
            <div class="bookshelf-mode-card-desc">EPUB, FB2, DOCX, DOC, TXT — автоматическое извлечение глав</div>
          </a>
          <a href="admin.html?mode=manual" class="bookshelf-mode-card">
            <div class="bookshelf-mode-card-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </div>
            <div class="bookshelf-mode-card-title">Создать вручную</div>
            <div class="bookshelf-mode-card-desc">Обложка, главы, фоны — полный контроль</div>
          </a>
          <a href="admin.html?mode=album" class="bookshelf-mode-card">
            <div class="bookshelf-mode-card-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                <path fill="currentColor" d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
              </svg>
            </div>
            <div class="bookshelf-mode-card-title">Фотоальбом</div>
            <div class="bookshelf-mode-card-desc">Раскладки, фото, подписи — визуальный редактор</div>
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Показать/скрыть экран выбора режима
   * @private
   */
  _toggleModeSelector(show) {
    this._currentView = show ? 'mode-selector' : 'shelf';
    const selector = this.container.querySelector('.bookshelf-mode-selector');
    const shelfContent = this.container.querySelectorAll(
      '.bookshelf-header, .bookshelf-shelves, .bookshelf-actions, .bookshelf-empty'
    );

    if (selector) selector.hidden = !show;
    shelfContent.forEach(el => el.hidden = show);
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

    // Клик по книге
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
    if (!raw) return { shouldShow: true, books: [DEFAULT_BOOKSHELF_BOOK] };

    const config = JSON.parse(raw);
    const books = Array.isArray(config.books) && config.books.length
      ? config.books
      : [DEFAULT_BOOKSHELF_BOOK];

    // Показываем шкаф если нет activeBookId (пользователь ещё не выбрал книгу)
    const hasActiveBook = !!config.activeBookId;

    return {
      shouldShow: !hasActiveBook,
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
    if (!raw) return;

    const config = JSON.parse(raw);
    delete config.activeBookId;
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* повреждённые данные — игнорируем */
  }
}
