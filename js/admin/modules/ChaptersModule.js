/**
 * Модуль управления главами, обложкой и книгами
 * Делегирует фотоальбом → AlbumManager, загрузку книг → BookUploadManager
 */
import { BaseModule } from './BaseModule.js';
import { AlbumManager } from './AlbumManager.js';
import { BookUploadManager } from './BookUploadManager.js';
import { BookParser } from '../BookParser.js';
import { QuillEditorWrapper } from './QuillEditorWrapper.js';

export class ChaptersModule extends BaseModule {
  /** Максимальный размер загружаемого файла главы (10 МБ) */
  static CHAPTER_FILE_MAX_SIZE = 10 * 1024 * 1024;
  /** Допустимые расширения */
  static CHAPTER_FILE_EXTENSIONS = ['.doc', '.docx', '.html', '.htm', '.txt'];

  constructor(app) {
    super(app);
    this._editingIndex = null;
    /** HTML-контент, загруженный через файл (pending до сохранения) */
    this._pendingHtmlContent = null;
    /** @type {QuillEditorWrapper} */
    this._editor = new QuillEditorWrapper();
    /** @type {'upload'|'editor'} Текущий режим ввода контента */
    this._inputMode = 'upload';
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
    this.inputTitle = document.getElementById('chapterTitle');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');

    // Загрузка файла главы
    this.chapterFileInput = document.getElementById('chapterFileInput');
    this.chapterFileDropzone = document.getElementById('chapterFileDropzone');
    this.chapterFileInfo = document.getElementById('chapterFileInfo');
    this.chapterFileName = document.getElementById('chapterFileName');
    this.chapterFileRemove = document.getElementById('chapterFileRemove');

    // Переключатель режима ввода (файл / редактор)
    this.chapterInputToggle = document.getElementById('chapterInputToggle');
    this.chapterUploadPanel = document.getElementById('chapterUploadPanel');
    this.chapterEditorPanel = document.getElementById('chapterEditorPanel');
    this.chapterEditorContainer = document.getElementById('chapterEditorContainer');

    // Делегаты
    this._album.cacheDOM();
    this._bookUpload.cacheDOM();
  }

  bindEvents() {
    // Главы
    this.addChapterBtn.addEventListener('click', () => this._openModal());
    this.cancelModal.addEventListener('click', () => this.modal.close());
    this.chapterForm.addEventListener('submit', (e) => this._handleChapterSubmit(e));

    // Загрузка файла главы
    this.chapterFileDropzone.addEventListener('click', () => this.chapterFileInput.click());
    this.chapterFileInput.addEventListener('change', (e) => this._handleChapterFileSelect(e));
    this.chapterFileRemove.addEventListener('click', () => this._removeChapterFile());

    // Переключатель режима ввода (файл / редактор)
    this.chapterInputToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-input-mode]');
      if (!btn) return;
      this._switchInputMode(btn.dataset.inputMode);
    });

    // Drag-and-drop на dropzone
    this.chapterFileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.chapterFileDropzone.classList.add('dragover');
    });
    this.chapterFileDropzone.addEventListener('dragleave', () => {
      this.chapterFileDropzone.classList.remove('dragover');
    });
    this.chapterFileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.chapterFileDropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this._processChapterFile(file);
    });

    // Переключатель книг (делегирование) — клик на карточку книги
    this.bookSelector.addEventListener('click', (e) => {
      // Сортировка книг (вверх/вниз)
      const moveBtn = e.target.closest('[data-book-move]');
      if (moveBtn) {
        e.stopPropagation();
        const index = parseInt(moveBtn.dataset.bookIndex, 10);
        const direction = moveBtn.dataset.bookMove;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        this.store.moveBook(index, newIndex);
        this._renderBookSelector();
        this._renderJsonPreview();
        this._showToast('Порядок изменён');
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
    this._album.bindEvents();
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
    this.chaptersList.innerHTML = chapters.map((ch, i) => {
      const isAlbum = !!ch.albumData;
      const typeLabel = isAlbum
        ? '<span class="chapter-type-badge chapter-type-badge--album">Альбом</span>'
        : '';
      const metaText = isAlbum
        ? `${ch.albumData.pages?.length || 0} стр.`
        : (ch.htmlContent ? 'Встроенный контент' : this._escapeHtml(ch.file));
      return `
      <div class="chapter-card${isAlbum ? ' chapter-card--album' : ''}" data-index="${i}">
        <div class="chapter-drag" title="Перетащите для изменения порядка">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <div class="chapter-info">
          <div class="chapter-title">${this._escapeHtml(ch.title || ch.id)}${typeLabel}</div>
          <div class="chapter-meta">${ch.title ? `${this._escapeHtml(ch.id)} · ` : ''}${metaText}</div>
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
    `;
    }).join('');

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
        case 'edit': {
          const chapter = this.store.getChapters()[index];
          if (chapter?.albumData) {
            this.app._showView('album');
            this._album.openForEdit(index);
          } else {
            this._openModal(index);
          }
          break;
        }
        case 'delete':
          this._confirm('Удалить эту главу?').then((ok) => {
            if (!ok) return;
            this.store.removeChapter(index);
            this._renderChapters();
            this._renderJsonPreview();
            this._showToast('Глава удалена');
          });
          break;
      }
    };
  }

  // --- Переключатель книг (bookshelf) ---

  _renderBookSelector() {
    const books = this.store.getBooks();
    const activeId = this.store.getActiveBookId();

    this.bookSelector.innerHTML = books.map((b, i) => `
      <div class="book-card${b.id === activeId ? ' active' : ''}" data-book-id="${this._escapeHtml(b.id)}" tabindex="0" role="button" aria-label="${this._escapeHtml(b.title || 'Без названия')}">
        <div class="book-card-info">
          <div class="book-card-title">${this._escapeHtml(b.title || 'Без названия')}</div>
          <div class="book-card-meta">${this._escapeHtml(b.author || '')}${b.author ? ' · ' : ''}${b.chaptersCount} гл.</div>
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

  async _handleDeleteBook(bookId) {
    const books = this.store.getBooks();
    if (books.length <= 1) {
      this._showToast('Нельзя удалить единственную книгу');
      return;
    }
    const book = books.find(b => b.id === bookId);
    if (!await this._confirm(`Удалить книгу «${book?.title || bookId}»?`)) return;

    this.store.removeBook(bookId);
    this.app._render();
    this.app._showView('bookshelf');
    this._showToast('Книга удалена');
  }

  // --- Модальное окно главы ---

  async _openModal(editIndex = null) {
    this._editingIndex = editIndex;
    this._pendingHtmlContent = null;
    this.chapterFileInput.value = '';

    // Уничтожить предыдущий экземпляр редактора
    if (this._editor.isInitialized) {
      this._editor.destroy();
    }

    if (editIndex !== null) {
      const ch = this.store.getChapters()[editIndex];
      this.modalTitle.textContent = 'Редактировать главу';
      this.inputId.value = ch.id;
      this.inputTitle.value = ch.title || '';
      this.inputBg.value = ch.bg || '';
      this.inputBgMobile.value = ch.bgMobile || '';

      if (ch.htmlContent) {
        // Встроенный контент — открыть в редакторе
        this._pendingHtmlContent = ch.htmlContent;
        this._resetChapterFileUI();
        await this._switchInputMode('editor');
        this._editor.setHTML(ch.htmlContent);
      } else if (ch.file) {
        // URL-путь — показать имя файла в режиме загрузки
        await this._switchInputMode('upload');
        this._showChapterFileInfo(ch.file);
      } else {
        await this._switchInputMode('upload');
        this._resetChapterFileUI();
      }
    } else {
      this.modalTitle.textContent = 'Добавить главу';
      this.chapterForm.reset();
      await this._switchInputMode('upload');
      this._resetChapterFileUI();
    }

    this.modal.showModal();
  }

  /**
   * Переключить режим ввода контента: 'upload' или 'editor'.
   * Асинхронный — Quill загружается лениво при первом переключении в режим редактора.
   * @param {'upload'|'editor'} mode
   */
  async _switchInputMode(mode) {
    if (mode === this._inputMode && mode === 'upload') {
      // Уже в режиме загрузки — ничего не делать
      return;
    }

    this._inputMode = mode;

    // Переключить active на кнопках
    const buttons = this.chapterInputToggle.querySelectorAll('[data-input-mode]');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.inputMode === mode);
    });

    // Переключить панели
    this.chapterUploadPanel.hidden = (mode !== 'upload');
    this.chapterEditorPanel.hidden = (mode !== 'editor');

    // Ширина модального окна
    this.modal.classList.toggle('editor-active', mode === 'editor');

    // Ленивая инициализация Quill при первом переключении в режим редактора
    if (mode === 'editor' && !this._editor.isInitialized) {
      await this._editor.init(this.chapterEditorContainer);
    }

    // Загрузить pending-контент в редактор при переключении
    if (mode === 'editor' && this._pendingHtmlContent) {
      this._editor.setHTML(this._pendingHtmlContent);
    }
  }

  _handleChapterSubmit(e) {
    e.preventDefault();

    const chapterTitle = this.inputTitle.value.trim();
    const chapter = {
      id: this.inputId.value.trim(),
      title: chapterTitle || '',
      file: '',
      bg: this.inputBg.value.trim(),
      bgMobile: this.inputBgMobile.value.trim(),
    };

    // Собрать HTML из WYSIWYG-редактора, если он активен и содержит контент
    if (this._inputMode === 'editor' && this._editor.isInitialized && !this._editor.isEmpty()) {
      this._pendingHtmlContent = this._editor.getHTML();
    }

    // Загруженный / существующий HTML-контент
    if (this._pendingHtmlContent) {
      chapter.htmlContent = this._pendingHtmlContent;
    }

    // При редактировании: сохранить file path если нет нового контента
    if (this._editingIndex !== null && !chapter.htmlContent) {
      const existing = this.store.getChapters()[this._editingIndex];
      if (existing.file) {
        chapter.file = existing.file;
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

    // Очистить состояние
    this._pendingHtmlContent = null;
    if (this._editor.isInitialized) {
      this._editor.destroy();
    }
    this.modal.close();
    this._renderChapters();
    this._renderJsonPreview();
  }

  // --- Загрузка файла главы ---

  _handleChapterFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._processChapterFile(file);
  }

  async _processChapterFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!ChaptersModule.CHAPTER_FILE_EXTENSIONS.includes(ext)) {
      this._showToast(`Допустимые форматы: ${ChaptersModule.CHAPTER_FILE_EXTENSIONS.join(', ')}`);
      this.chapterFileInput.value = '';
      return;
    }

    if (file.size > ChaptersModule.CHAPTER_FILE_MAX_SIZE) {
      this._showToast(`Файл слишком большой (макс. ${ChaptersModule.CHAPTER_FILE_MAX_SIZE / (1024 * 1024)} МБ)`);
      this.chapterFileInput.value = '';
      return;
    }

    try {
      this.chapterFileDropzone.classList.add('loading');

      let html;
      if (ext === '.html' || ext === '.htm') {
        html = await file.text();
      } else {
        // doc, docx, txt — через BookParser
        const parsed = await BookParser.parse(file);
        html = parsed.chapters.map(ch => ch.html).join('\n');
      }

      if (!html || !html.trim()) {
        this._showToast('Файл пуст или не удалось извлечь контент');
        return;
      }

      this._pendingHtmlContent = html;
      this._showChapterFileInfo(file.name);
      this._showToast('Файл загружен');
    } catch (err) {
      this._showToast(`Ошибка чтения файла: ${err.message}`);
    } finally {
      this.chapterFileDropzone.classList.remove('loading');
      this.chapterFileInput.value = '';
    }
  }

  _removeChapterFile() {
    this._pendingHtmlContent = null;
    this.chapterFileInput.value = '';

    // Очистить редактор, если инициализирован
    if (this._editor.isInitialized) {
      this._editor.clear();
    }

    // При редактировании — сбросить существующий контент
    if (this._editingIndex !== null) {
      const existing = this.store.getChapters()[this._editingIndex];
      if (existing.file) {
        // Есть URL-путь — вернуть его отображение
        this._showChapterFileInfo(existing.file);
        return;
      }
    }

    this._resetChapterFileUI();
  }

  _showChapterFileInfo(name) {
    this.chapterFileDropzone.hidden = true;
    this.chapterFileInfo.hidden = false;
    this.chapterFileName.textContent = name;
  }

  _resetChapterFileUI() {
    this.chapterFileDropzone.hidden = false;
    this.chapterFileInfo.hidden = true;
    this.chapterFileName.textContent = '';
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
