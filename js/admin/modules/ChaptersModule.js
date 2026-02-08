/**
 * Модуль управления главами, обложкой, книгами и загрузкой книг
 */
import { BookParser } from '../BookParser.js';
import { BaseModule } from './BaseModule.js';

export class ChaptersModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editingIndex = null;
    this._pendingParsedBook = null;
  }

  cacheDOM() {
    // Главы
    this.chaptersList = document.getElementById('chaptersList');
    this.chaptersEmpty = document.getElementById('chaptersEmpty');
    this.addChapterBtn = document.getElementById('addChapter');

    // Переключатель книг
    this.bookSelector = document.getElementById('bookSelector');
    this.deleteBookBtn = document.getElementById('deleteBook');

    // Под-табы
    this.bookSubtabs = document.getElementById('bookSubtabs');
    this.subtabBtns = document.querySelectorAll('.book-subtab');
    this.subtabContents = document.querySelectorAll('.book-subtab-content');

    // Загрузка книги
    this.bookUploadArea = document.getElementById('bookUploadArea');
    this.bookDropzone = document.getElementById('bookDropzone');
    this.bookFileInput = document.getElementById('bookFileInput');
    this.bookUploadProgress = document.getElementById('bookUploadProgress');
    this.bookUploadStatus = document.getElementById('bookUploadStatus');
    this.bookUploadResult = document.getElementById('bookUploadResult');
    this.bookUploadTitle = document.getElementById('bookUploadTitle');
    this.bookUploadAuthor = document.getElementById('bookUploadAuthor');
    this.bookUploadChaptersCount = document.getElementById('bookUploadChaptersCount');
    this.bookUploadConfirm = document.getElementById('bookUploadConfirm');
    this.bookUploadCancel = document.getElementById('bookUploadCancel');

    // Обложка (в табе Главы)
    this.coverTitle = document.getElementById('coverTitle');
    this.coverAuthor = document.getElementById('coverAuthor');
    this.coverBgInput = document.getElementById('coverBg');
    this.coverBgMobileInput = document.getElementById('coverBgMobile');
    this.saveCoverBtn = document.getElementById('saveCover');

    // Модальное окно
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputFile = document.getElementById('chapterFile');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');
  }

  bindEvents() {
    // Главы
    this.addChapterBtn.addEventListener('click', () => this._openModal());
    this.cancelModal.addEventListener('click', () => this.modal.close());
    this.chapterForm.addEventListener('submit', (e) => this._handleChapterSubmit(e));

    // Под-табы (Создать / Загрузить)
    this.subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => this._switchSubtab(btn.dataset.subtab));
    });

    // Переключатель книг (делегирование)
    this.bookSelector.addEventListener('click', (e) => {
      const card = e.target.closest('[data-book-id]');
      if (!card) return;

      const deleteBtn = e.target.closest('[data-book-delete]');
      if (deleteBtn) {
        e.stopPropagation();
        this._handleDeleteBook(deleteBtn.dataset.bookDelete);
        return;
      }

      this._handleSelectBook(card.dataset.bookId);
    });

    // Удаление активной книги
    this.deleteBookBtn.addEventListener('click', () => {
      this._handleDeleteBook(this.store.getActiveBookId());
    });

    // Загрузка книги
    this.bookDropzone.addEventListener('click', () => this.bookFileInput.click());
    this.bookFileInput.addEventListener('change', (e) => this._handleBookUpload(e));
    this.bookDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.bookDropzone.classList.add('dragover');
    });
    this.bookDropzone.addEventListener('dragleave', () => {
      this.bookDropzone.classList.remove('dragover');
    });
    this.bookDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.bookDropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this._processBookFile(file);
    });
    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());

    // Обложка (таб Главы)
    this.saveCoverBtn.addEventListener('click', () => this._saveCover());
  }

  render() {
    this._renderBookSelector();
    this._renderCover();
    this._renderChapters();
  }

  // --- Рендер ---

  _renderCover() {
    const cover = this.store.getCover();
    this.coverTitle.value = cover.title;
    this.coverAuthor.value = cover.author;
    this.coverBgInput.value = cover.bg || '';
    this.coverBgMobileInput.value = cover.bgMobile || '';
  }

  _renderChapters() {
    const chapters = this.store.getChapters();

    if (chapters.length === 0) {
      this.chaptersList.innerHTML = '';
      this.chaptersEmpty.hidden = false;
      return;
    }

    this.chaptersEmpty.hidden = true;
    this.chaptersList.innerHTML = chapters.map((ch, i) => `
      <div class="chapter-card" data-index="${i}">
        <div class="chapter-drag" title="Перетащите для изменения порядка">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <div class="chapter-info">
          <div class="chapter-title">${this._escapeHtml(ch.id)}</div>
          <div class="chapter-meta">${ch.htmlContent ? 'Встроенный контент' : this._escapeHtml(ch.file)}</div>
        </div>
        <div class="chapter-actions">
          ${i > 0 ? `<button class="chapter-action-btn" data-action="up" data-index="${i}" title="Вверх">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>` : ''}
          ${i < chapters.length - 1 ? `<button class="chapter-action-btn" data-action="down" data-index="${i}" title="Вниз">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>` : ''}
          <button class="chapter-action-btn" data-action="edit" data-index="${i}" title="Редактировать">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="chapter-action-btn delete" data-action="delete" data-index="${i}" title="Удалить">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Делегирование событий на кнопки
    this.chaptersList.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.index, 10);

      switch (action) {
        case 'up':
          this.store.moveChapter(index, index - 1);
          this._renderChapters();
          this._renderJsonPreview();
          this._showToast('Порядок изменён');
          break;
        case 'down':
          this.store.moveChapter(index, index + 1);
          this._renderChapters();
          this._renderJsonPreview();
          this._showToast('Порядок изменён');
          break;
        case 'edit':
          this._openModal(index);
          break;
        case 'delete':
          if (confirm('Удалить эту главу?')) {
            this.store.removeChapter(index);
            this._renderChapters();
            this._renderJsonPreview();
            this._showToast('Глава удалена');
          }
          break;
      }
    };
  }

  // --- Переключатель книг ---

  _renderBookSelector() {
    const books = this.store.getBooks();
    const activeId = this.store.getActiveBookId();

    this.bookSelector.innerHTML = books.map(b => `
      <div class="book-card${b.id === activeId ? ' active' : ''}" data-book-id="${this._escapeHtml(b.id)}">
        <div class="book-card-info">
          <div class="book-card-title">${this._escapeHtml(b.title || 'Без названия')}</div>
          <div class="book-card-meta">${this._escapeHtml(b.author || '')}${b.author ? ' · ' : ''}${b.chaptersCount} гл.</div>
        </div>
        <div class="book-card-actions">
          ${b.id === activeId ? '<span class="book-card-active-badge">Активна</span>' : ''}
          ${books.length > 1 ? `<button class="chapter-action-btn delete" data-book-delete="${this._escapeHtml(b.id)}" title="Удалить книгу">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>` : ''}
        </div>
      </div>
    `).join('');

    this.deleteBookBtn.hidden = books.length <= 1;
  }

  _handleSelectBook(bookId) {
    if (bookId === this.store.getActiveBookId()) return;
    this.store.setActiveBook(bookId);
    this.app._render();
    this._showToast('Книга переключена');
  }

  _handleDeleteBook(bookId) {
    const books = this.store.getBooks();
    if (books.length <= 1) {
      this._showToast('Нельзя удалить единственную книгу');
      return;
    }
    const book = books.find(b => b.id === bookId);
    if (!confirm(`Удалить книгу «${book?.title || bookId}»?`)) return;

    this.store.removeBook(bookId);
    this.app._render();
    this._showToast('Книга удалена');
  }

  // --- Под-табы ---

  _switchSubtab(subtabName) {
    this.subtabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subtabName);
    });
    this.subtabContents.forEach(content => {
      const isActive = content.dataset.subtabContent === subtabName;
      content.classList.toggle('active', isActive);
      content.hidden = !isActive;
    });
  }

  // --- Модальное окно главы ---

  _openModal(editIndex = null) {
    this._editingIndex = editIndex;

    if (editIndex !== null) {
      const ch = this.store.getChapters()[editIndex];
      this.modalTitle.textContent = 'Редактировать главу';
      this.inputId.value = ch.id;
      this.inputFile.value = ch.file;
      this.inputBg.value = ch.bg || '';
      this.inputBgMobile.value = ch.bgMobile || '';
    } else {
      this.modalTitle.textContent = 'Добавить главу';
      this.chapterForm.reset();
    }

    this.modal.showModal();
  }

  _handleChapterSubmit(e) {
    e.preventDefault();

    const chapter = {
      id: this.inputId.value.trim(),
      file: this.inputFile.value.trim(),
      bg: this.inputBg.value.trim(),
      bgMobile: this.inputBgMobile.value.trim(),
    };

    // При редактировании сохранить inline-контент, если file не указан
    if (this._editingIndex !== null) {
      const existing = this.store.getChapters()[this._editingIndex];
      if (existing.htmlContent && !chapter.file) {
        chapter.htmlContent = existing.htmlContent;
      }
    }

    if (!chapter.id || (!chapter.file && !chapter.htmlContent)) return;

    if (this._editingIndex !== null) {
      this.store.updateChapter(this._editingIndex, chapter);
      this._showToast('Глава обновлена');
    } else {
      this.store.addChapter(chapter);
      this._showToast('Глава добавлена');
    }

    this.modal.close();
    this._renderChapters();
    this._renderJsonPreview();
  }

  // --- Обложка ---

  _saveCover() {
    this.store.updateCover({
      title: this.coverTitle.value.trim(),
      author: this.coverAuthor.value.trim(),
      bg: this.coverBgInput.value.trim(),
      bgMobile: this.coverBgMobileInput.value.trim(),
    });

    this._renderJsonPreview();
    this._showToast('Обложка сохранена');
  }

  // --- Загрузка книги ---

  _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._processBookFile(file);
    e.target.value = '';
  }

  async _processBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedFormats = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    if (!supportedFormats.includes(ext)) {
      this._showToast('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      return;
    }

    this.bookDropzone.hidden = true;
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = 'Обработка файла...';

    try {
      const parsed = await BookParser.parse(file);
      this._pendingParsedBook = parsed;

      this.bookUploadProgress.hidden = true;
      this.bookUploadResult.hidden = false;
      this.bookUploadTitle.textContent = parsed.title || 'Без названия';
      this.bookUploadAuthor.textContent = parsed.author ? `Автор: ${parsed.author}` : '';
      this.bookUploadChaptersCount.textContent = `Найдено глав: ${parsed.chapters.length}`;
    } catch (err) {
      this._showToast(`Ошибка: ${err.message}`);
      this._resetBookUpload();
    }
  }

  async _applyParsedBook() {
    if (!this._pendingParsedBook) return;

    const { title, author, chapters } = this._pendingParsedBook;

    const newChapters = chapters.map(ch => ({
      id: ch.id,
      file: '',
      htmlContent: ch.html,
      bg: '',
      bgMobile: '',
    }));

    const bookId = `book_${Date.now()}`;

    this.store.addBook({
      id: bookId,
      cover: {
        title: title || 'Без названия',
        author: author || '',
        bg: '',
        bgMobile: '',
      },
      chapters: newChapters,
    });

    try {
      await this.store.waitForSave();
    } catch {
      this.store.removeBook(bookId);
      this._showToast('Ошибка сохранения: недостаточно места в хранилище');
      return;
    }

    this.store.setActiveBook(bookId);

    this.app._render();
    this._resetBookUpload();
    this._showToast(`Книга «${title || 'Без названия'}» добавлена (${chapters.length} гл.)`);
  }

  _resetBookUpload() {
    this._pendingParsedBook = null;
    this.bookDropzone.hidden = false;
    this.bookUploadProgress.hidden = true;
    this.bookUploadResult.hidden = true;
  }
}
