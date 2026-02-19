/**
 * Модуль управления главами, обложкой и книгами
 * Делегирует фотоальбом → AlbumManager, загрузку книг → BookUploadManager
 */
import { BaseModule } from './BaseModule.js';
import { AlbumManager } from './AlbumManager.js';
import { BookUploadManager } from './BookUploadManager.js';

export class ChaptersModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editingIndex = null;
    this._album = new AlbumManager(this);
    this._bookUpload = new BookUploadManager(this);
  }

  cacheDOM() {
    // Главы
    this.chaptersList = document.getElementById('chaptersList');
    this.chaptersEmpty = document.getElementById('chaptersEmpty');
    this.addChapterBtn = document.getElementById('addChapter');
    this.addAlbumBtn = document.getElementById('addAlbum');

    // Переключатель книг (bookshelf view)
    this.bookSelector = document.getElementById('bookSelector');
    this.deleteBookBtn = document.getElementById('deleteBook');

    // Обложка (в editor → cover tab)
    this.coverTitle = document.getElementById('coverTitle');
    this.coverAuthor = document.getElementById('coverAuthor');
    this.bgCoverMode = document.getElementById('bgCoverMode');
    this.bgCoverOptions = document.querySelectorAll('.texture-option[data-bg-mode]');
    this.bgCoverFileInput = document.getElementById('bgCoverFileInput');
    this.bgCoverThumb = document.getElementById('bgCoverThumb');
    this.bgCoverCustomInfo = document.getElementById('bgCoverCustomInfo');
    this.bgCoverCustomName = document.getElementById('bgCoverCustomName');
    this.bgCoverRemove = document.getElementById('bgCoverRemove');
    this.saveCoverBtn = document.getElementById('saveCover');

    // Модальное окно главы
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputFile = document.getElementById('chapterFile');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');

    // Делегаты
    this._album.cacheDOM();
    this._bookUpload.cacheDOM();
  }

  bindEvents() {
    // Главы
    this.addChapterBtn.addEventListener('click', () => this._openModal());
    this.cancelModal.addEventListener('click', () => this.modal.close());
    this.chapterForm.addEventListener('submit', (e) => this._handleChapterSubmit(e));

    // Переключатель книг (делегирование) — клик на карточку книги
    this.bookSelector.addEventListener('click', (e) => {
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

    // Удаление активной книги (кнопка в editor)
    this.deleteBookBtn.addEventListener('click', () => {
      this._handleDeleteBook(this.store.getActiveBookId());
    });

    // Обложка — фон-подложка (mode selector)
    this.bgCoverOptions.forEach(btn => {
      btn.addEventListener('click', () => this._selectBgMode(btn.dataset.bgMode));
    });
    this.bgCoverFileInput.addEventListener('change', (e) => this._handleBgUpload(e));
    this.bgCoverRemove.addEventListener('click', () => this._removeBgCustom());

    this.saveCoverBtn.addEventListener('click', () => this._saveCover());

    // Альбом — кнопка в табе «Главы» (переход в album view)
    this.addAlbumBtn.addEventListener('click', () => {
      this.app._showView('album');
      this._album.openInView();
    });

    // Делегаты
    this._bookUpload.bindEvents();
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
    this._renderBgModeSelector(cover.bgMode || 'default', cover.bgCustomData);
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

  // --- Переключатель книг (bookshelf) ---

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
    if (bookId !== this.store.getActiveBookId()) {
      this.store.setActiveBook(bookId);
      this.app._render();
    }
    this.app.openEditor();
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
    this.app._showView('bookshelf');
    this._showToast('Книга удалена');
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

  // --- Обложка / фон-подложка ---

  _renderBgModeSelector(modeValue, customData) {
    const uploadOption = this.bgCoverOptions[this.bgCoverOptions.length - 1]?.closest('label');

    this.bgCoverOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bgMode === modeValue);
    });

    if (uploadOption) {
      uploadOption.classList.toggle('active', modeValue === 'custom');
    }

    this.bgCoverMode.value = modeValue;

    if (customData) {
      this.bgCoverThumb.style.backgroundImage = `url(${customData})`;
      this.bgCoverThumb.classList.add('has-image');
      this.bgCoverCustomInfo.hidden = false;
      this.bgCoverCustomName.textContent = 'Своё изображение';
    } else {
      this.bgCoverThumb.style.backgroundImage = '';
      this.bgCoverThumb.classList.remove('has-image');
      this.bgCoverCustomInfo.hidden = true;
    }
  }

  _selectBgMode(value) {
    const cover = this.store.getCover();
    this._renderBgModeSelector(value, cover.bgCustomData);
  }

  _handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'image/', inputEl: e.target })) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      this.store.updateCover({ bgMode: 'custom', bgCustomData: dataUrl });
      this._renderBgModeSelector('custom', dataUrl);
      this._renderJsonPreview();
      this._showToast('Фон загружен');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _removeBgCustom() {
    this.store.updateCover({ bgMode: 'default', bgCustomData: null });
    this._renderBgModeSelector('default', null);
    this._renderJsonPreview();
    this._showToast('Своё изображение удалено');
  }

  _saveCover() {
    this.store.updateCover({
      title: this.coverTitle.value.trim(),
      author: this.coverAuthor.value.trim(),
      bgMode: this.bgCoverMode.value,
    });

    // Обновить заголовок редактора
    this.app.editorTitle.textContent = this.coverTitle.value.trim() || 'Редактор книги';

    this._renderBookSelector();
    this._renderJsonPreview();
    this._showToast('Обложка сохранена');
  }
}
