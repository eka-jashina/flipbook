/**
 * Модуль управления главами, обложкой и книгами
 * Делегирует:
 *   фотоальбом → AlbumManager
 *   загрузку книг → BookUploadManager
 *   переключатель книг → BookSelectorManager
 *   обложку → CoverManager
 *   файлы глав → ChapterFileHandler
 */
import { BaseModule } from './BaseModule.js';
import { AlbumManager } from './AlbumManager.js';
import { BookUploadManager } from './BookUploadManager.js';
import { BookSelectorManager } from './BookSelectorManager.js';
import { CoverManager } from './CoverManager.js';
import { ChapterFileHandler } from './ChapterFileHandler.js';
import { QuillEditorWrapper } from './QuillEditorWrapper.js';
import { t } from '@i18n';

export class ChaptersModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editingIndex = null;
    /** HTML-контент, загруженный через файл (pending до сохранения) */
    this._pendingHtmlContent = null;
    /** @type {QuillEditorWrapper} */
    this._editor = new QuillEditorWrapper();
    /** @type {'upload'|'editor'} Текущий режим ввода контента */
    this._inputMode = 'upload';

    // Делегаты
    this._album = new AlbumManager(this);
    this._bookUpload = new BookUploadManager(this);
    this._bookSelector = new BookSelectorManager(this);
    this._cover = new CoverManager(this);
    this._fileHandler = new ChapterFileHandler(this);
  }

  cacheDOM() {
    // Главы
    this.chaptersList = document.getElementById('chaptersList');
    this.chaptersEmpty = document.getElementById('chaptersEmpty');
    this.addChapterBtn = document.getElementById('addChapter');
    this.addAlbumBtn = document.getElementById('addAlbum');

    // Модальное окно главы
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputTitle = document.getElementById('chapterTitle');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');

    // Переключатель режима ввода (файл / редактор)
    this.chapterInputToggle = document.getElementById('chapterInputToggle');
    this.chapterUploadPanel = document.getElementById('chapterUploadPanel');
    this.chapterEditorPanel = document.getElementById('chapterEditorPanel');
    this.chapterEditorContainer = document.getElementById('chapterEditorContainer');

    // Делегаты
    this._bookSelector.cacheDOM();
    this._cover.cacheDOM();
    this._fileHandler.cacheDOM();
    this._album.cacheDOM();
    this._bookUpload.cacheDOM();

    // Прокси-ссылки на DOM-элементы делегатов (совместимость с тестами)
    this.bookSelector = this._bookSelector.bookSelector;
    this.deleteBookBtn = this._bookSelector.deleteBookBtn;
    this.coverTitle = this._cover.coverTitle;
    this.coverAuthor = this._cover.coverAuthor;
    this.bgCoverMode = this._cover.bgCoverMode;
    this.bgCoverOptions = this._cover.bgCoverOptions;
    this.bgCoverFileInput = this._cover.bgCoverFileInput;
    this.bgCoverThumb = this._cover.bgCoverThumb;
    this.bgCoverCustomInfo = this._cover.bgCoverCustomInfo;
    this.bgCoverCustomName = this._cover.bgCoverCustomName;
    this.bgCoverRemove = this._cover.bgCoverRemove;
    this.saveCoverBtn = this._cover.saveCoverBtn;
    this.chapterFileInput = this._fileHandler.chapterFileInput;
    this.chapterFileDropzone = this._fileHandler.chapterFileDropzone;
    this.chapterFileInfo = this._fileHandler.chapterFileInfo;
    this.chapterFileName = this._fileHandler.chapterFileName;
    this.chapterFileRemove = this._fileHandler.chapterFileRemove;
  }

  bindEvents() {
    // Главы
    this.addChapterBtn.addEventListener('click', () => this._openModal());
    this.cancelModal.addEventListener('click', () => this.modal.close());
    this.chapterForm.addEventListener('submit', (e) => this._handleChapterSubmit(e));

    // Переключатель режима ввода (файл / редактор)
    this.chapterInputToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-input-mode]');
      if (!btn) return;
      this._switchInputMode(btn.dataset.inputMode);
    });

    // Альбом — кнопка в табе «Главы» (переход в album view)
    this.addAlbumBtn.addEventListener('click', () => {
      this.app._showView('album');
      this._album.openInView();
    });

    // Делегаты
    this._bookSelector.bindEvents();
    this._cover.bindEvents();
    this._fileHandler.bindEvents();
    this._album.bindEvents();
    this._bookUpload.bindEvents();
  }

  async render() {
    this._bookSelector.render();
    await this._cover.render();
    await this._renderChapters();
  }

  // --- Рендер списка глав ---

  async _renderChapters() {
    const chapters = await this.store.getChapters();

    if (chapters.length === 0) {
      this.chaptersList.innerHTML = '';
      this.chaptersEmpty.hidden = false;
      return;
    }

    this.chaptersEmpty.hidden = true;
    this.chaptersList.innerHTML = chapters.map((ch, i) => {
      const isAlbum = !!ch.albumData;
      const typeLabel = isAlbum
        ? `<span class="chapter-type-badge chapter-type-badge--album">${t('admin.chapters.albumType')}</span>`
        : '';
      const metaText = isAlbum
        ? t('admin.chapters.pageCount', { count: ch.albumData.pages?.length || 0 })
        : (ch.htmlContent ? t('admin.chapters.embedded') : this._escapeHtml(ch.file));
      return `
      <div class="chapter-card${isAlbum ? ' chapter-card--album' : ''}" data-index="${i}">
        <div class="chapter-drag" title="${t('admin.chapters.dragHint')}">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <div class="chapter-info">
          <div class="chapter-title">${this._escapeHtml(ch.title || ch.id)}${typeLabel}</div>
          <div class="chapter-meta">${ch.title ? `${this._escapeHtml(ch.id)} · ` : ''}${metaText}</div>
        </div>
        <div class="chapter-actions">
          ${i > 0 ? `<button class="chapter-action-btn" data-action="up" data-index="${i}" title="${t('admin.chapters.moveUp')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>` : ''}
          ${i < chapters.length - 1 ? `<button class="chapter-action-btn" data-action="down" data-index="${i}" title="${t('admin.chapters.moveDown')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>` : ''}
          <button class="chapter-action-btn" data-action="edit" data-index="${i}" title="${t('common.edit')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="chapter-action-btn delete" data-action="delete" data-index="${i}" title="${t('common.delete')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `;
    }).join('');

    // Делегирование событий на кнопки
    this.chaptersList.onclick = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.index, 10);

      switch (action) {
        case 'up':
          await this.store.moveChapter(index, index - 1);
          await this._renderChapters();
          this._renderJsonPreview();
          this._showToast(t('admin.chapters.orderChanged'));
          break;
        case 'down':
          await this.store.moveChapter(index, index + 1);
          await this._renderChapters();
          this._renderJsonPreview();
          this._showToast(t('admin.chapters.orderChanged'));
          break;
        case 'edit': {
          const chapters = await this.store.getChapters();
          const chapter = chapters[index];
          if (chapter?.albumData) {
            this.app._showView('album');
            await this._album.openForEdit(index);
          } else {
            this._openModal(index);
          }
          break;
        }
        case 'delete':
          this._confirm(t('admin.chapters.deleteConfirm')).then(async (ok) => {
            if (!ok) return;
            await this.store.removeChapter(index);
            await this._renderChapters();
            this._renderJsonPreview();
            this._showToast(t('admin.chapters.deleted'));
          });
          break;
      }
    };
  }

  // --- Модальное окно главы ---

  async _openModal(editIndex = null) {
    this._editingIndex = editIndex;
    this._pendingHtmlContent = null;
    this._fileHandler.chapterFileInput.value = '';

    // Уничтожить предыдущий экземпляр редактора
    if (this._editor.isInitialized) {
      this._editor.destroy();
    }

    if (editIndex !== null) {
      const chapters = await this.store.getChapters();
      const ch = chapters[editIndex];
      this.modalTitle.textContent = t('admin.chapters.editTitle');
      this.inputId.value = ch.id;
      this.inputTitle.value = ch.title || '';
      this.inputBg.value = ch.bg || '';
      this.inputBgMobile.value = ch.bgMobile || '';

      if (ch.htmlContent) {
        this._pendingHtmlContent = ch.htmlContent;
        this._fileHandler.resetUI();
        await this._switchInputMode('editor');
        this._editor.setHTML(ch.htmlContent);
      } else if (ch.file) {
        await this._switchInputMode('upload');
        this._fileHandler.showFileInfo(ch.file);
      } else {
        await this._switchInputMode('upload');
        this._fileHandler.resetUI();
      }
    } else {
      this.modalTitle.textContent = t('admin.chapters.addTitle');
      this.chapterForm.reset();
      await this._switchInputMode('upload');
      this._fileHandler.resetUI();
    }

    this.modal.showModal();
  }

  /**
   * Переключить режим ввода контента: 'upload' или 'editor'.
   * Асинхронный — Quill загружается лениво при первом переключении в режим редактора.
   * @param {'upload'|'editor'} mode
   */
  async _switchInputMode(mode) {
    if (mode === this._inputMode && mode === 'upload') return;

    this._inputMode = mode;

    const buttons = this.chapterInputToggle.querySelectorAll('[data-input-mode]');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.inputMode === mode);
    });

    this.chapterUploadPanel.hidden = (mode !== 'upload');
    this.chapterEditorPanel.hidden = (mode !== 'editor');
    this.modal.classList.toggle('editor-active', mode === 'editor');

    if (mode === 'editor' && !this._editor.isInitialized) {
      await this._editor.init(this.chapterEditorContainer);
    }

    if (mode === 'editor' && this._pendingHtmlContent) {
      this._editor.setHTML(this._pendingHtmlContent);
    }
  }

  async _handleChapterSubmit(e) {
    e.preventDefault();

    const chapterTitle = this.inputTitle.value.trim();
    const chapter = {
      id: this.inputId.value.trim(),
      title: chapterTitle || '',
      file: '',
      bg: this.inputBg.value.trim(),
      bgMobile: this.inputBgMobile.value.trim(),
    };

    if (this._inputMode === 'editor' && this._editor.isInitialized && !this._editor.isEmpty()) {
      this._pendingHtmlContent = this._editor.getHTML();
    }

    if (this._pendingHtmlContent) {
      chapter.htmlContent = this._pendingHtmlContent;
    }

    if (this._editingIndex !== null && !chapter.htmlContent) {
      const chapters = await this.store.getChapters();
      const existing = chapters[this._editingIndex];
      if (existing?.file) {
        chapter.file = existing.file;
      }
    }

    if (!chapter.id || (!chapter.file && !chapter.htmlContent)) return;

    if (this._editingIndex !== null) {
      await this.store.updateChapter(this._editingIndex, chapter);
      this._showToast(t('admin.chapters.updated'));
    } else {
      await this.store.addChapter(chapter);
      this._showToast(t('admin.chapters.added'));
    }

    this._pendingHtmlContent = null;
    if (this._editor.isInitialized) {
      this._editor.destroy();
    }
    this.modal.close();
    await this._renderChapters();
    this._renderJsonPreview();
  }

  // --- Прокси-методы для делегатов (совместимость с тестами и внешними вызовами) ---

  /** @see BookSelectorManager#render */
  _renderBookSelector() { this._bookSelector.render(); }

  /** @see BookSelectorManager#_handleSelectBook */
  _handleSelectBook(bookId) { this._bookSelector._handleSelectBook(bookId); }

  /** @see BookSelectorManager#_handleDeleteBook */
  _handleDeleteBook(bookId) { return this._bookSelector._handleDeleteBook(bookId); }

  /** @see CoverManager#render */
  _renderCover() { this._cover.render(); }

  /** @see CoverManager#_renderBgModeSelector */
  _renderBgModeSelector(mode, data) { this._cover._renderBgModeSelector(mode, data); }

  /** @see CoverManager#_selectBgMode */
  _selectBgMode(value) { this._cover._selectBgMode(value); }

  /** @see CoverManager#_handleBgUpload */
  _handleBgUpload(e) { return this._cover._handleBgUpload(e); }

  /** @see CoverManager#_removeBgCustom */
  _removeBgCustom() { this._cover._removeBgCustom(); }

  /** @see CoverManager#_saveCover */
  _saveCover() { this._cover._saveCover(); }

  /** @see ChapterFileHandler#processFile */
  _processChapterFile(file) { return this._fileHandler.processFile(file); }

  /** @see ChapterFileHandler#removeFile */
  _removeChapterFile() { this._fileHandler.removeFile(); }

  /** @see ChapterFileHandler#showFileInfo */
  _showChapterFileInfo(name) { this._fileHandler.showFileInfo(name); }

  /** @see ChapterFileHandler#resetUI */
  _resetChapterFileUI() { this._fileHandler.resetUI(); }
}
