/**
 * Менеджер переключателя книг (bookshelf view в админке)
 * Отвечает за рендер карточек книг, выбор и удаление книг, сортировку.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
export class BookSelectorManager {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /** Кэшировать DOM-элементы переключателя книг */
  cacheDOM() {
    this.bookSelector = document.getElementById('bookSelector');
    this.deleteBookBtn = document.getElementById('deleteBook');
  }

  /** Привязать события переключателя книг */
  bindEvents() {
    // Делегирование — клик на карточку книги
    this.bookSelector.addEventListener('click', (e) => {
      // Сортировка книг (вверх/вниз)
      const moveBtn = e.target.closest('[data-book-move]');
      if (moveBtn) {
        e.stopPropagation();
        const index = parseInt(moveBtn.dataset.bookIndex, 10);
        const direction = moveBtn.dataset.bookMove;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        this._host.store.moveBook(index, newIndex);
        this.render();
        this._host._renderJsonPreview();
        this._host._showToast('Порядок изменён');
        return;
      }

      const card = e.target.closest('[data-book-id]');
      if (!card) return;

      const deleteBtn = e.target.closest('[data-book-delete]');
      if (deleteBtn) {
        e.stopPropagation();
        this._handleDeleteBook(deleteBtn.dataset.bookDelete);
        return;
      }

      // Выбрать книгу и открыть редактор
      this._handleSelectBook(card.dataset.bookId);
    });

    // Клавиатурная навигация для карточек книг (Enter / Space)
    this.bookSelector.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-book-id]');
      if (!card) return;
      e.preventDefault();
      this._handleSelectBook(card.dataset.bookId);
    });

    // Удаление активной книги (кнопка в editor)
    this.deleteBookBtn.addEventListener('click', () => {
      this._handleDeleteBook(this._host.store.getActiveBookId());
    });
  }

  /** Рендер переключателя книг */
  render() {
    const books = this._host.store.getBooks();
    const activeId = this._host.store.getActiveBookId();

    this.bookSelector.innerHTML = books.map((b, i) => `
      <div class="book-card${b.id === activeId ? ' active' : ''}" data-book-id="${this._host._escapeHtml(b.id)}" tabindex="0" role="button" aria-label="${this._host._escapeHtml(b.title || 'Без названия')}">
        <div class="book-card-info">
          <div class="book-card-title">${this._host._escapeHtml(b.title || 'Без названия')}</div>
          <div class="book-card-meta">${this._host._escapeHtml(b.author || '')}${b.author ? ' · ' : ''}${b.chaptersCount} гл.</div>
        </div>
        <div class="book-card-actions">
          ${books.length > 1 ? `<div class="book-card-sort">
            ${i > 0 ? `<button class="chapter-action-btn" data-book-move="up" data-book-index="${i}" title="Влево">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>` : ''}
            ${i < books.length - 1 ? `<button class="chapter-action-btn" data-book-move="down" data-book-index="${i}" title="Вправо">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>` : ''}
          </div>` : ''}
          ${b.id === activeId ? '<span class="book-card-active-badge">Активна</span>' : ''}
          ${books.length > 1 ? `<button class="chapter-action-btn delete" data-book-delete="${this._host._escapeHtml(b.id)}" title="Удалить книгу">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>` : ''}
        </div>
      </div>
    `).join('');

    this.deleteBookBtn.hidden = books.length <= 1;
  }

  _handleSelectBook(bookId) {
    if (bookId !== this._host.store.getActiveBookId()) {
      this._host.store.setActiveBook(bookId);
      this._host.app._render();
    }
    this._host.app.openEditor();
  }

  async _handleDeleteBook(bookId) {
    const books = this._host.store.getBooks();
    if (books.length <= 1) {
      this._host._showToast('Нельзя удалить единственную книгу');
      return;
    }
    const book = books.find(b => b.id === bookId);
    if (!await this._host._confirm(`Удалить книгу «${book?.title || bookId}»?`)) return;

    this._host.store.removeBook(bookId);
    this._host.app._render();
    this._host.app._showView('bookshelf');
    this._host._showToast('Книга удалена');
  }
}
