/**
 * INTEGRATION TEST: Bookshelf Screen
 * Тестирование BookshelfScreen: рендеринг полок, контекстное меню,
 * выбор книги, удаление, переключение режимов.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import {
  BookshelfScreen,
  getBookshelfData,
  clearActiveBook,
  loadBooksFromAPI,
} from '../../../js/core/BookshelfScreen.js';

// Mock admin mode cards data
vi.mock('../../../js/admin/modeCardsData.js', () => ({
  renderModeCards: vi.fn(),
}));

describe('Bookshelf Screen Integration', () => {
  let container;
  let onBookSelect;

  const createBookshelfDOM = () => {
    container = document.createElement('div');
    container.id = 'bookshelf';

    // Static elements expected by BookshelfScreen
    const header = document.createElement('div');
    header.className = 'bookshelf-header';
    container.appendChild(header);

    const subtitle = document.createElement('span');
    subtitle.id = 'bookshelf-subtitle';
    container.appendChild(subtitle);

    const shelves = document.createElement('div');
    shelves.id = 'bookshelf-shelves';
    container.appendChild(shelves);

    const actions = document.createElement('div');
    actions.id = 'bookshelf-actions';

    const addBtn = document.createElement('button');
    addBtn.dataset.action = 'add-book';
    actions.appendChild(addBtn);
    container.appendChild(actions);

    const empty = document.createElement('div');
    empty.id = 'bookshelf-empty';
    empty.hidden = true;
    container.appendChild(empty);

    const modeSelector = document.createElement('div');
    modeSelector.id = 'bookshelf-mode-selector';
    modeSelector.hidden = true;

    const backBtn = document.createElement('button');
    backBtn.dataset.action = 'back-to-shelf';
    modeSelector.appendChild(backBtn);
    container.appendChild(modeSelector);

    const modeCards = document.createElement('div');
    modeCards.id = 'bookshelf-mode-cards';
    container.appendChild(modeCards);

    // Templates
    const shelfTemplate = document.createElement('template');
    shelfTemplate.id = 'tmpl-bookshelf-shelf';
    const shelfContent = document.createElement('div');
    shelfContent.className = 'bookshelf-shelf';
    const booksContainer = document.createElement('div');
    booksContainer.className = 'bookshelf-books';
    shelfContent.appendChild(booksContainer);
    shelfTemplate.content.appendChild(shelfContent);
    document.body.appendChild(shelfTemplate);

    const bookTemplate = document.createElement('template');
    bookTemplate.id = 'tmpl-bookshelf-book';
    const wrapper = document.createElement('div');
    wrapper.className = 'bookshelf-book-wrapper';

    const btn = document.createElement('button');
    btn.className = 'bookshelf-book';

    const cover = document.createElement('div');
    cover.className = 'bookshelf-book-cover';
    btn.appendChild(cover);

    const title = document.createElement('div');
    title.className = 'bookshelf-book-title';
    btn.appendChild(title);

    const author = document.createElement('div');
    author.className = 'bookshelf-book-author';
    btn.appendChild(author);

    wrapper.appendChild(btn);

    // Menu
    const menu = document.createElement('div');
    menu.className = 'bookshelf-book-menu';
    menu.hidden = true;

    const readItem = document.createElement('button');
    readItem.dataset.bookAction = 'read';
    menu.appendChild(readItem);

    const editItem = document.createElement('button');
    editItem.dataset.bookAction = 'edit';
    menu.appendChild(editItem);

    const deleteItem = document.createElement('button');
    deleteItem.dataset.bookAction = 'delete';
    menu.appendChild(deleteItem);

    wrapper.appendChild(menu);
    bookTemplate.content.appendChild(wrapper);
    document.body.appendChild(bookTemplate);

    document.body.appendChild(container);
    return container;
  };

  const createTestBooks = (count = 3) => {
    const books = [];
    for (let i = 1; i <= count; i++) {
      books.push({
        id: `book-${i}`,
        title: `Book ${i}`,
        author: `Author ${i}`,
        appearance: {
          light: {
            coverBgStart: '#3a2d1f',
            coverBgEnd: '#2a2016',
            coverText: '#f2e9d8',
          },
        },
      });
    }
    return books;
  };

  beforeEach(() => {
    onBookSelect = vi.fn();
    createBookshelfDOM();
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    // Clean templates
    document.querySelectorAll('template').forEach(t => t.remove());
  });

  describe('Rendering', () => {
    it('should render books on shelves', () => {
      const books = createTestBooks(3);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const shelves = container.querySelectorAll('.bookshelf-shelf');
      expect(shelves.length).toBe(1); // 3 books fit on 1 shelf (5 per shelf)

      const bookEls = container.querySelectorAll('.bookshelf-book-wrapper');
      expect(bookEls.length).toBe(3);
    });

    it('should create multiple shelves for many books', () => {
      const books = createTestBooks(8);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const shelves = container.querySelectorAll('.bookshelf-shelf');
      expect(shelves.length).toBe(2); // 8 books = 2 shelves (5 + 3)
    });

    it('should show empty state when no books', () => {
      const screen = new BookshelfScreen({ container, books: [], onBookSelect });
      screen.render();

      const empty = container.querySelector('#bookshelf-empty');
      expect(empty.hidden).toBe(false);

      const shelves = container.querySelector('#bookshelf-shelves');
      expect(shelves.hidden).toBe(true);
    });

    it('should display book count in subtitle', () => {
      const books = createTestBooks(3);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const subtitle = container.querySelector('#bookshelf-subtitle');
      expect(subtitle.textContent).toBe('3 книги');
    });

    it('should pluralize correctly', () => {
      // 1 книга
      let screen = new BookshelfScreen({ container, books: createTestBooks(1), onBookSelect });
      screen.render();
      expect(container.querySelector('#bookshelf-subtitle').textContent).toBe('1 книга');

      // 5 книг
      screen = new BookshelfScreen({ container, books: createTestBooks(5), onBookSelect });
      screen.render();
      expect(container.querySelector('#bookshelf-subtitle').textContent).toBe('5 книг');

      // 21 книга
      screen = new BookshelfScreen({ container, books: createTestBooks(21), onBookSelect });
      screen.render();
      expect(container.querySelector('#bookshelf-subtitle').textContent).toBe('21 книга');
    });

    it('should set book title and author from API format', () => {
      const books = [{
        id: 'b1',
        title: 'My Book',
        author: 'My Author',
        appearance: { light: { coverBgStart: '#333', coverBgEnd: '#111', coverText: '#fff' } },
      }];

      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const titleEl = container.querySelector('.bookshelf-book-title');
      expect(titleEl.textContent).toBe('My Book');
    });

    it('should set cover gradient from appearance', () => {
      const books = [{
        id: 'b1',
        title: 'Test',
        author: '',
        appearance: { light: { coverBgStart: '#ff0000', coverBgEnd: '#00ff00', coverText: '#0000ff' } },
      }];

      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const cover = container.querySelector('.bookshelf-book-cover');
      // jsdom converts hex colors to rgb()
      expect(cover.style.background).toContain('linear-gradient');
      expect(cover.style.background).toContain('135deg');
    });
  });

  describe('Book selection and context menu', () => {
    it('should open menu on book click', () => {
      const books = createTestBooks(1);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const bookBtn = container.querySelector('.bookshelf-book');
      bookBtn.click();

      const wrapper = container.querySelector('.bookshelf-book-wrapper');
      expect(wrapper.classList.contains('menu-open')).toBe(true);

      const menu = wrapper.querySelector('.bookshelf-book-menu');
      expect(menu.hidden).toBe(false);

      screen.destroy();
    });

    it('should call onBookSelect when read action clicked', () => {
      const books = createTestBooks(1);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      // Open menu first
      const bookBtn = container.querySelector('.bookshelf-book');
      bookBtn.click();

      // Click read action
      const readBtn = container.querySelector('[data-book-action="read"]');
      readBtn.click();

      expect(onBookSelect).toHaveBeenCalledWith('book-1');

      screen.destroy();
    });

    it('should close menu on second book click', () => {
      const books = createTestBooks(2);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      // Open first book menu
      const bookBtns = container.querySelectorAll('.bookshelf-book');
      bookBtns[0].click();

      const firstWrapper = container.querySelectorAll('.bookshelf-book-wrapper')[0];
      expect(firstWrapper.classList.contains('menu-open')).toBe(true);

      // Click second book — should close first
      bookBtns[1].click();

      expect(firstWrapper.classList.contains('menu-open')).toBe(false);

      const secondWrapper = container.querySelectorAll('.bookshelf-book-wrapper')[1];
      expect(secondWrapper.classList.contains('menu-open')).toBe(true);

      screen.destroy();
    });
  });

  describe('Book deletion', () => {
    it('should delete book from localStorage when confirmed', async () => {
      const books = createTestBooks(2);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      // Mock confirm
      global.confirm = vi.fn(() => true);

      // Setup localStorage
      localStorage.setItem('flipbook-admin-config', JSON.stringify({
        books: [{ id: 'book-1' }, { id: 'book-2' }],
        activeBookId: 'book-1',
      }));

      // Simulate delete action
      screen._deleteBook('book-1');

      expect(screen.books.length).toBe(1);
      expect(screen.books[0].id).toBe('book-2');
    });

    it('should not delete when confirm cancelled', () => {
      const books = createTestBooks(2);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      global.confirm = vi.fn(() => false);

      screen._deleteBook('book-1');

      expect(screen.books.length).toBe(2);

      screen.destroy();
    });

    it('should delete via API when apiClient provided', async () => {
      const mockApi = {
        deleteBook: vi.fn().mockResolvedValue(),
      };

      const books = createTestBooks(2);
      const screen = new BookshelfScreen({
        container, books, onBookSelect,
        apiClient: mockApi,
      });
      screen.render();

      global.confirm = vi.fn(() => true);

      await screen._deleteBook('book-1');

      expect(mockApi.deleteBook).toHaveBeenCalledWith('book-1');
      expect(screen.books.length).toBe(1);
    });
  });

  describe('Mode selector toggle', () => {
    it('should show mode selector when add-book clicked', () => {
      const books = createTestBooks(1);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const addBtn = container.querySelector('[data-action="add-book"]');
      addBtn.click();

      const modeSelector = container.querySelector('#bookshelf-mode-selector');
      expect(modeSelector.hidden).toBe(false);

      const shelves = container.querySelector('#bookshelf-shelves');
      expect(shelves.hidden).toBe(true);

      screen.destroy();
    });

    it('should return to shelf view on back button', () => {
      const books = createTestBooks(1);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      // Show mode selector
      const addBtn = container.querySelector('[data-action="add-book"]');
      addBtn.click();

      // Click back
      const backBtn = container.querySelector('[data-action="back-to-shelf"]');
      backBtn.click();

      const modeSelector = container.querySelector('#bookshelf-mode-selector');
      expect(modeSelector.hidden).toBe(true);

      const shelves = container.querySelector('#bookshelf-shelves');
      expect(shelves.hidden).toBe(false);

      screen.destroy();
    });
  });

  describe('Show/Hide', () => {
    it('should show bookshelf and set screen to bookshelf', () => {
      const screen = new BookshelfScreen({
        container, books: createTestBooks(1), onBookSelect,
      });
      screen.render();

      container.hidden = true;
      screen.show();

      expect(container.hidden).toBe(false);
      expect(document.body.dataset.screen).toBe('bookshelf');

      screen.destroy();
    });

    it('should set screen to reader on hide', () => {
      const screen = new BookshelfScreen({
        container, books: createTestBooks(1), onBookSelect,
      });
      screen.render();

      screen.hide();

      expect(document.body.dataset.screen).toBe('reader');

      screen.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should clear dynamic content on destroy', () => {
      const books = createTestBooks(3);
      const screen = new BookshelfScreen({ container, books, onBookSelect });
      screen.render();

      const shelves = container.querySelector('#bookshelf-shelves');
      expect(shelves.children.length).toBeGreaterThan(0);

      screen.destroy();

      expect(shelves.innerHTML).toBe('');
    });
  });

  describe('getBookshelfData()', () => {
    it('should return default book when no config', () => {
      localStorage.removeItem('flipbook-admin-config');
      const { shouldShow, books } = getBookshelfData();

      expect(shouldShow).toBe(true);
      expect(books.length).toBe(1);
      expect(books[0].id).toBe('default');
    });

    it('should return books from localStorage config', () => {
      localStorage.setItem('flipbook-admin-config', JSON.stringify({
        books: [
          { id: 'b1', title: 'Book 1' },
          { id: 'b2', title: 'Book 2' },
        ],
        activeBookId: 'b1',
      }));

      const { books } = getBookshelfData();
      expect(books.length).toBe(2);
    });

    it('should show shelf when no active book', () => {
      localStorage.setItem('flipbook-admin-config', JSON.stringify({
        books: [{ id: 'b1' }],
      }));

      const { shouldShow } = getBookshelfData();
      expect(shouldShow).toBe(true);
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('flipbook-admin-config', 'not-json');

      const { shouldShow, books } = getBookshelfData();
      expect(shouldShow).toBe(true);
      expect(books[0].id).toBe('default');
    });
  });

  describe('clearActiveBook()', () => {
    it('should remove activeBookId from config', () => {
      localStorage.setItem('flipbook-admin-config', JSON.stringify({
        books: [{ id: 'b1' }],
        activeBookId: 'b1',
      }));

      clearActiveBook();

      const config = JSON.parse(localStorage.getItem('flipbook-admin-config'));
      expect(config.activeBookId).toBeUndefined();
    });

    it('should remove reading session from sessionStorage', () => {
      sessionStorage.setItem('flipbook-reading-session', '1');

      clearActiveBook();

      expect(sessionStorage.getItem('flipbook-reading-session')).toBeNull();
    });
  });

  describe('loadBooksFromAPI()', () => {
    it('should fetch books from API client', async () => {
      const mockApi = {
        getBooks: vi.fn().mockResolvedValue([
          { id: 'b1', title: 'API Book' },
        ]),
      };

      const books = await loadBooksFromAPI(mockApi);

      expect(mockApi.getBooks).toHaveBeenCalled();
      expect(books.length).toBe(1);
      expect(books[0].title).toBe('API Book');
    });
  });
});
