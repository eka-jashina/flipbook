/**
 * Модуль управления главами, обложкой и книгами
 * Делегирует:
 *   фотоальбом → AlbumManager
 *   загрузку книг → BookUploadManager
 *   переключатель книг → BookSelectorManager
 *   обложку → CoverManager
 *   файлы глав → ChapterFileHandler
 *
 * Главы редактируются inline — раскрывающиеся карточки вместо модального окна.
 */
import { BaseModule } from './BaseModule.js';
import { AlbumManager } from './AlbumManager.js';
import { BookUploadManager } from './BookUploadManager.js';
import { BookSelectorManager } from './BookSelectorManager.js';
import { CoverManager } from './CoverManager.js';
import { ChapterFileHandler } from './ChapterFileHandler.js';
import { QuillEditorWrapper } from './QuillEditorWrapper.js';
import { BookParser } from '../BookParser.js';
import { setupDropzone } from './adminHelpers.js';
import { t } from '@i18n';

/** Допустимые расширения для импорта книги */
const IMPORT_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

export class ChaptersModule extends BaseModule {
  constructor(app) {
    super(app);
    /** Индекс раскрытой главы (-1 = все свёрнуты) */
    this._expandedIndex = -1;
    /** HTML-контент, загруженный через файл (pending до сохранения) */
    this._pendingHtmlContent = null;
    /** @type {QuillEditorWrapper} */
    this._editor = new QuillEditorWrapper(app.store);
    /** @type {'upload'|'editor'} Текущий режим ввода контента в раскрытой карточке */
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

    // Дропзона импорта книги (в табе глав)
    this.importDropzone = document.getElementById('chaptersImportDropzone');
    this.importFileInput = document.getElementById('chaptersImportFileInput');

    // Модальное окно главы (legacy — сохраняем ссылки для совместимости с тестами)
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputTitle = document.getElementById('chapterTitle');
    this.inputBg = document.getElementById('chapterBg');
    this.inputBgMobile = document.getElementById('chapterBgMobile');

    // Переключатель режима ввода (legacy — для совместимости)
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
    // Добавить главу / раздел — создаёт пустую и раскрывает
    this.addChapterBtn.addEventListener('click', () => {
      if (this._isAlbumBook()) {
        this._addNewSection();
      } else {
        this._addNewChapter();
      }
    });

    // Альбом — кнопка в табе «Главы» (добавить альбом-раздел)
    this.addAlbumBtn.addEventListener('click', () => {
      if (this._isAlbumBook()) {
        // В режиме альбома кнопка добавляет новый раздел
        this._addNewSection();
      } else {
        this.app._showView('album');
        this._album.openInView();
      }
    });

    // Дропзона импорта файла книги
    if (this.importDropzone && this.importFileInput) {
      setupDropzone(this.importDropzone, this.importFileInput, (file) => this._importBookFile(file));
      this.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this._importBookFile(file);
      });
    }

    // Делегаты
    this._bookSelector.bindEvents();
    this._cover.bindEvents();
    this._fileHandler.bindEvents();
    this._album.bindEvents();
    this._bookUpload.bindEvents();
  }

  /** Является ли текущая книга альбомом */
  _isAlbumBook() {
    return this.store.getBookType?.() === 'album';
  }

  async render() {
    this._bookSelector.render();
    await this._cover.render();
    this._updateAlbumModeUI();
    await this._renderChapters();
  }

  /** Обновить UI кнопок и надписей для режима альбома */
  _updateAlbumModeUI() {
    const isAlbum = this._isAlbumBook();
    // Переименовать кнопку «Добавить главу» → «Добавить раздел»
    const addLabel = this.addChapterBtn.querySelector('span');
    if (addLabel) {
      addLabel.textContent = isAlbum ? t('admin.sections.addSection') : t('admin.chapters.addChapter');
    }
    // Скрыть кнопку «Фотоальбом» для альбомных книг (там все разделы — альбомные)
    if (this.addAlbumBtn) {
      this.addAlbumBtn.hidden = isAlbum;
    }
    // Обновить пустое состояние
    const emptyTitle = this.chaptersEmpty?.querySelector('[data-i18n="admin.chapters.emptyTitle"]')
      || this.chaptersEmpty?.querySelector('p:first-of-type');
    const emptyHint = this.chaptersEmpty?.querySelector('[data-i18n="admin.chapters.emptyHint"]')
      || this.chaptersEmpty?.querySelector('.empty-hint');
    if (emptyTitle) emptyTitle.textContent = isAlbum ? t('admin.sections.emptyTitle') : t('admin.chapters.emptyTitle');
    if (emptyHint) emptyHint.textContent = isAlbum ? t('admin.sections.emptyHint') : t('admin.chapters.emptyHint');
  }

  // ═══════════════════════════════════════════
  // Импорт книги из файла
  // ═══════════════════════════════════════════

  async _importBookFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      this._showToast(t('admin.chapters.unsupportedFormat', { formats: IMPORT_EXTENSIONS.join(', ') }));
      if (this.importFileInput) this.importFileInput.value = '';
      return;
    }

    try {
      this.importDropzone.classList.add('loading');
      const parsed = await BookParser.parse(file);

      for (const ch of parsed.chapters) {
        await this.store.addChapter({
          id: ch.id || `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: ch.title || '',
          file: '',
          htmlContent: ch.html || '',
          bg: '',
          bgMobile: '',
        });
      }

      await this._renderChapters();
      this._renderJsonPreview();
      this._showToast(t('admin.chapters.importSuccess', { count: parsed.chapters.length }));
    } catch (err) {
      this._showToast(t('admin.chapters.fileReadError', { message: err.message }));
    } finally {
      this.importDropzone.classList.remove('loading');
      if (this.importFileInput) this.importFileInput.value = '';
    }
  }

  // ═══════════════════════════════════════════
  // Рендер списка глав (inline-раскрывающиеся карточки)
  // ═══════════════════════════════════════════

  async _renderChapters() {
    // Перед перерендером — сохранить раскрытую главу
    await this._saveExpandedChapter();

    const chapters = await this.store.getChapters();

    if (chapters.length === 0) {
      this.chaptersList.innerHTML = '';
      this.chaptersEmpty.hidden = false;
      return;
    }

    this.chaptersEmpty.hidden = true;
    this.chaptersList.innerHTML = chapters.map((ch, i) => this._renderChapterCard(ch, i, chapters.length)).join('');

    // Делегирование событий
    this.chaptersList.onclick = (e) => this._handleChapterListClick(e);
  }

  /**
   * HTML одной карточки главы
   */
  _renderChapterCard(ch, index, total) {
    const isAlbum = !!ch.albumData;
    const isAlbumBook = this._isAlbumBook();
    // В альбомной книге не показываем бейдж «Альбом» — там все разделы альбомные
    const typeLabel = (isAlbum && !isAlbumBook)
      ? `<span class="chapter-type-badge chapter-type-badge--album">${t('admin.chapters.albumType')}</span>`
      : '';
    const metaText = isAlbum
      ? t('admin.chapters.pageCount', { count: ch.albumData.pages?.length || 0 })
      : (ch.htmlContent ? t('admin.chapters.embedded') : this._escapeHtml(ch.file || ''));

    return `
    <div class="chapter-card" data-index="${index}">
      <div class="chapter-card-header" data-action="toggle" data-index="${index}">
        <div class="chapter-drag" title="${t('admin.chapters.dragHint')}">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        <svg class="chapter-expand-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
        </svg>
        <div class="chapter-info">
          <div class="chapter-title">${this._escapeHtml(ch.title || ch.id)}${typeLabel}</div>
          <div class="chapter-meta">${ch.title ? `${this._escapeHtml(ch.id)} · ` : ''}${metaText}</div>
        </div>
        <div class="chapter-actions">
          ${index > 0 ? `<button class="chapter-action-btn" data-action="up" data-index="${index}" title="${t('admin.chapters.moveUp')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>` : ''}
          ${index < total - 1 ? `<button class="chapter-action-btn" data-action="down" data-index="${index}" title="${t('admin.chapters.moveDown')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>` : ''}
          <button class="chapter-action-btn delete" data-action="delete" data-index="${index}" title="${t('common.delete')}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
      <div class="chapter-card-body">
        <!-- Заполняется динамически при раскрытии -->
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════
  // Обработка кликов по списку глав
  // ═══════════════════════════════════════════

  async _handleChapterListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index, 10);

    // Не обрабатывать drag-handle
    if (e.target.closest('.chapter-drag')) return;

    switch (action) {
      case 'toggle':
        await this._toggleChapter(index);
        break;
      case 'up':
        e.stopPropagation();
        await this._saveExpandedChapter();
        this._expandedIndex = -1;
        await this.store.moveChapter(index, index - 1);
        await this._renderChapters();
        this._renderJsonPreview();
        this._showToast(t('admin.chapters.orderChanged'));
        break;
      case 'down':
        e.stopPropagation();
        await this._saveExpandedChapter();
        this._expandedIndex = -1;
        await this.store.moveChapter(index, index + 1);
        await this._renderChapters();
        this._renderJsonPreview();
        this._showToast(t('admin.chapters.orderChanged'));
        break;
      case 'delete':
        e.stopPropagation();
        this._confirm(t('admin.chapters.deleteConfirm')).then(async (ok) => {
          if (!ok) return;
          if (this._expandedIndex === index) {
            this._destroyInlineEditor();
            this._expandedIndex = -1;
          } else if (this._expandedIndex > index) {
            this._expandedIndex--;
          }
          await this.store.removeChapter(index);
          await this._renderChapters();
          this._renderJsonPreview();
          this._showToast(t('admin.chapters.deleted'));
        });
        break;
    }
  }

  // ═══════════════════════════════════════════
  // Раскрытие / свёртывание глав
  // ═══════════════════════════════════════════

  async _toggleChapter(index) {
    const chapters = await this.store.getChapters();
    const ch = chapters[index];

    // Альбомы с albumData — в режиме обычной книги открываем в отдельном view,
    // в режиме альбомной книги — раскрываем inline
    if (ch?.albumData && !this._isAlbumBook()) {
      this.app._showView('album');
      await this._album.openForEdit(index);
      return;
    }

    if (this._expandedIndex === index) {
      // Свернуть — сохранить и закрыть
      await this._saveExpandedChapter();
      this._collapseAll();
      return;
    }

    // Сохранить предыдущую раскрытую (если есть)
    await this._saveExpandedChapter();
    this._collapseAll();

    // Раскрыть новую
    this._expandedIndex = index;
    const card = this.chaptersList.querySelector(`.chapter-card[data-index="${index}"]`);
    if (!card) return;

    card.classList.add('chapter-card--expanded');
    const body = card.querySelector('.chapter-card-body');

    if (this._isAlbumBook()) {
      // Альбомный раздел — инициализируем inline-редактор альбома
      body.innerHTML = this._renderSectionBody(ch, index);
      this._initInlineSectionControls(body, ch, index);
    } else {
      body.innerHTML = this._renderChapterBody(ch, index);
      // Инициализировать файловую дропзону и переключатель режимов
      this._initInlineControls(body, ch);
    }
  }

  _collapseAll() {
    this._expandedIndex = -1;
    this._destroyInlineEditor();
    this._pendingHtmlContent = null;
    this._inputMode = 'upload';
    // Восстановить albumPagesEl, если был inline-режим альбома
    if (this._restoreAlbumPagesEl) {
      this._restoreAlbumPagesEl();
      this._restoreAlbumPagesEl = null;
    }
    this.chaptersList.querySelectorAll('.chapter-card--expanded').forEach(card => {
      card.classList.remove('chapter-card--expanded');
      const body = card.querySelector('.chapter-card-body');
      if (body) body.innerHTML = '';
    });
  }

  /**
   * HTML тела раскрытой карточки
   */
  _renderChapterBody(ch, _index) {
    const hasHtml = !!ch.htmlContent;
    const hasFile = !!ch.file;
    const uploadActive = !hasHtml ? 'active' : '';
    const editorActive = hasHtml ? 'active' : '';

    return `
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.idLabel')}</label>
        <input class="form-input chapter-inline-id" type="text" value="${this._escapeHtml(ch.id)}" placeholder="${t('admin.modal.chapter.idPlaceholder')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.titleLabel')}</label>
        <input class="form-input chapter-inline-title" type="text" value="${this._escapeHtml(ch.title || '')}" placeholder="${t('admin.modal.chapter.titlePlaceholder')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.contentLabel')}</label>
        <div class="chapter-inline-toggle">
          <button type="button" class="chapter-inline-toggle-btn ${uploadActive}" data-input-mode="upload">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
            ${t('admin.modal.chapter.uploadMode')}
          </button>
          <button type="button" class="chapter-inline-toggle-btn ${editorActive}" data-input-mode="editor">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            ${t('admin.modal.chapter.editorMode')}
          </button>
        </div>
        <!-- Режим: загрузка файла -->
        <div class="chapter-inline-upload-panel" ${hasHtml ? 'hidden' : ''}>
          <input type="file" class="chapter-inline-file-input" accept=".doc,.docx,.html,.htm,.txt" hidden>
          <div class="chapter-inline-file-dropzone" ${hasFile ? 'hidden' : ''}>
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
            <p class="chapter-file-text">${t('admin.modal.chapter.dropzoneText')}</p>
            <p class="chapter-file-hint">${t('admin.modal.chapter.dropzoneHint')}</p>
          </div>
          <div class="chapter-inline-file-info" ${hasFile ? '' : 'hidden'}>
            <span class="chapter-inline-file-name">${hasFile ? this._escapeHtml(ch.file) : ''}</span>
            <button type="button" class="chapter-file-remove" data-action-inline="remove-file" title="${t('admin.modal.chapter.removeFile')}">&times;</button>
          </div>
        </div>
        <!-- Режим: WYSIWYG-редактор -->
        <div class="chapter-inline-editor-panel" ${hasHtml ? '' : 'hidden'}>
          <div class="chapter-inline-editor-container"></div>
        </div>
      </div>
      <div class="chapter-bg-row">
        <div class="form-group">
          <label class="form-label">${t('admin.modal.chapter.bgDesktop')}</label>
          <input class="form-input chapter-inline-bg" type="text" value="${this._escapeHtml(ch.bg || '')}" placeholder="${t('admin.modal.chapter.bgDesktopPlaceholder')}">
        </div>
        <div class="form-group">
          <label class="form-label">${t('admin.modal.chapter.bgMobile')}</label>
          <input class="form-input chapter-inline-bg-mobile" type="text" value="${this._escapeHtml(ch.bgMobile || '')}" placeholder="${t('admin.modal.chapter.bgMobilePlaceholder')}">
        </div>
      </div>
      <div class="chapter-save-row">
        <button type="button" class="btn btn-primary chapter-save-btn" data-action-inline="save-chapter">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t('admin.chapters.saveChapter')}
        </button>
      </div>`;
  }

  /**
   * Инициализировать интерактивные элементы в раскрытой карточке
   */
  _initInlineControls(body, ch) {
    const toggle = body.querySelector('.chapter-inline-toggle');
    const uploadPanel = body.querySelector('.chapter-inline-upload-panel');
    const editorPanel = body.querySelector('.chapter-inline-editor-panel');
    const fileInput = body.querySelector('.chapter-inline-file-input');
    const dropzone = body.querySelector('.chapter-inline-file-dropzone');
    const fileInfo = body.querySelector('.chapter-inline-file-info');
    const fileRemove = body.querySelector('[data-action-inline="remove-file"]');
    const editorContainer = body.querySelector('.chapter-inline-editor-container');

    // Запомнить текущий режим
    this._inputMode = ch.htmlContent ? 'editor' : 'upload';
    this._pendingHtmlContent = ch.htmlContent || null;

    // Переключатель режима
    toggle.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-input-mode]');
      if (!btn) return;
      const mode = btn.dataset.inputMode;
      if (mode === this._inputMode) return;

      this._inputMode = mode;
      toggle.querySelectorAll('.chapter-inline-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.inputMode === mode);
      });
      uploadPanel.hidden = (mode !== 'upload');
      editorPanel.hidden = (mode !== 'editor');

      if (mode === 'editor') {
        if (!this._editor.isInitialized) {
          await this._editor.init(editorContainer);
        }
        if (this._pendingHtmlContent) {
          this._editor.setHTML(this._pendingHtmlContent);
        }
      }
    });

    // Дропзона загрузки файла
    if (dropzone && fileInput) {
      setupDropzone(dropzone, fileInput, (file) => this._processInlineFile(file, body));
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this._processInlineFile(file, body);
      });
    }

    // Удаление файла
    if (fileRemove) {
      fileRemove.addEventListener('click', () => {
        this._pendingHtmlContent = null;
        if (this._editor.isInitialized) this._editor.clear();
        if (dropzone) dropzone.hidden = false;
        if (fileInfo) fileInfo.hidden = true;
      });
    }

    // Кнопка «Сохранить главу»
    const saveBtn = body.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._handleSaveChapterClick());
    }

    // Если есть htmlContent — инициализировать Quill
    if (ch.htmlContent) {
      this._editor.init(editorContainer).then(() => {
        this._editor.setHTML(ch.htmlContent);
      });
    }
  }

  /**
   * Обработка файла в inline-дропзоне
   */
  async _processInlineFile(file, body) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.doc', '.docx', '.html', '.htm', '.txt'];

    if (!allowedExts.includes(ext)) {
      this._showToast(t('admin.chapters.unsupportedFormat', { formats: allowedExts.join(', ') }));
      return;
    }

    const dropzone = body.querySelector('.chapter-inline-file-dropzone');
    const fileInfo = body.querySelector('.chapter-inline-file-info');
    const fileName = body.querySelector('.chapter-inline-file-name');

    try {
      if (dropzone) dropzone.classList.add('loading');

      let html;
      if (ext === '.html' || ext === '.htm') {
        html = await file.text();
      } else {
        const parsed = await BookParser.parse(file);
        html = parsed.chapters.map(ch => ch.html).join('\n');
      }

      if (!html || !html.trim()) {
        this._showToast(t('admin.chapters.fileEmpty'));
        return;
      }

      this._pendingHtmlContent = html;
      if (dropzone) dropzone.hidden = true;
      if (fileInfo) fileInfo.hidden = false;
      if (fileName) fileName.textContent = file.name;
      this._showToast(t('admin.chapters.fileLoaded'));
    } catch (err) {
      this._showToast(t('admin.chapters.fileReadError', { message: err.message }));
    } finally {
      if (dropzone) dropzone.classList.remove('loading');
    }
  }

  // ═══════════════════════════════════════════
  // Добавление новой главы
  // ═══════════════════════════════════════════

  async _addNewChapter() {
    const newId = `ch_${Date.now()}`;
    await this.store.addChapter({
      id: newId,
      title: '',
      file: '',
      htmlContent: '',
      bg: '',
      bgMobile: '',
    });
    await this._renderChapters();

    // Раскрыть только что созданную главу
    const newChapters = await this.store.getChapters();
    const newIndex = newChapters.length - 1;
    await this._toggleChapter(newIndex);

    // Прокрутить к новой карточке
    const card = this.chaptersList.querySelector(`.chapter-card[data-index="${newIndex}"]`);
    if (card?.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ═══════════════════════════════════════════
  // Альбомные разделы (inline)
  // ═══════════════════════════════════════════

  /** Добавить новый раздел альбома */
  async _addNewSection() {
    const sectionId = `album_${Date.now()}`;
    await this.store.addChapter({
      id: sectionId,
      title: '',
      file: '',
      htmlContent: '',
      albumData: {
        title: '',
        hideTitle: true,
        pages: [{ layout: '1', images: [] }],
      },
      bg: '',
      bgMobile: '',
    });
    await this._renderChapters();

    // Раскрыть только что созданный раздел
    const newChapters = await this.store.getChapters();
    const newIndex = newChapters.length - 1;
    await this._toggleChapter(newIndex);

    const card = this.chaptersList.querySelector(`.chapter-card[data-index="${newIndex}"]`);
    if (card?.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * HTML тела раскрытого раздела альбома
   */
  _renderSectionBody(ch, _index) {
    const data = ch.albumData || { title: '', hideTitle: true, pages: [] };
    return `
      <div class="form-group">
        <label class="form-label">${t('admin.album.titleLabel')}</label>
        <input class="form-input section-inline-title" type="text" value="${this._escapeHtml(data.title || '')}" placeholder="${t('admin.album.titlePlaceholder')}">
      </div>
      <div class="form-group">
        <label class="admin-toggle album-hide-toggle">
          <input type="checkbox" class="section-inline-hide-title" ${data.hideTitle !== false ? 'checked' : ''}>
          <span class="admin-toggle-slider"></span>
        </label>
        <span class="album-hide-label">${t('admin.album.hideTitleLabel')}</span>
        <span class="form-hint">${t('admin.album.hideTitleHint')}</span>
      </div>
      <div class="section-inline-album-pages"></div>
      <div class="album-actions-row">
        <button class="btn btn-secondary album-add-page-btn section-add-page" type="button">${t('admin.album.addPage')}</button>
        <button class="btn btn-secondary album-bulk-upload-btn section-bulk-upload" type="button">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
          <span>${t('admin.album.bulkUpload')}</span>
        </button>
      </div>
      <div class="chapter-save-row">
        <button type="button" class="btn btn-primary chapter-save-btn" data-action-inline="save-chapter">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t('admin.chapters.saveChapter')}
        </button>
      </div>`;
  }

  /**
   * Инициализировать элементы управления для inline-раздела альбома
   */
  _initInlineSectionControls(body, ch, index) {
    const pagesContainer = body.querySelector('.section-inline-album-pages');
    const addPageBtn = body.querySelector('.section-add-page');
    const bulkUploadBtn = body.querySelector('.section-bulk-upload');

    // Сохраняем ссылку на текущие данные страниц
    const albumData = ch.albumData || { title: '', hideTitle: true, pages: [{ layout: '1', images: [] }] };
    this._inlineAlbumPages = structuredClone(albumData.pages);

    // Настроить AlbumManager для работы с inline-контейнером
    this._album._albumPages = this._inlineAlbumPages;
    this._album._editingChapterIndex = index;
    this._album._isDirty = false;

    // Подменяем albumPagesEl на inline-контейнер
    const origPagesEl = this._album.albumPagesEl;
    this._album.albumPagesEl = pagesContainer;
    this._album._renderAlbumPages();

    // Восстанавливаем оригинал при сворачивании (через _collapseAll hook)
    this._restoreAlbumPagesEl = () => {
      this._album.albumPagesEl = origPagesEl;
      this._inlineAlbumPages = null;
    };

    // Кнопка «+ Добавить страницу»
    addPageBtn.addEventListener('click', () => {
      this._album._addAlbumPage();
    });

    // Кнопка «Загрузить фото»
    bulkUploadBtn.addEventListener('click', () => {
      this._album._bulkUpload();
    });

    // Кнопка «Сохранить главу»
    const saveBtn = body.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._handleSaveChapterClick());
    }
  }

  // ═══════════════════════════════════════════
  // Сохранение раскрытой главы
  // ═══════════════════════════════════════════

  /**
   * Обработчик нажатия кнопки «Сохранить главу» —
   * сохраняет содержимое и показывает подтверждение.
   */
  async _handleSaveChapterClick() {
    const saveBtn = this.chaptersList.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = t('common.saving');
    }
    try {
      await this._saveExpandedChapter();
      this._showToast(t('admin.chapters.chapterSaved'));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> ${t('admin.chapters.saveChapter')}`;
      }
    }
  }

  async _saveExpandedChapter() {
    if (this._expandedIndex < 0) return;

    const card = this.chaptersList.querySelector(`.chapter-card[data-index="${this._expandedIndex}"]`);
    if (!card || !card.classList.contains('chapter-card--expanded')) return;

    const body = card.querySelector('.chapter-card-body');
    if (!body) return;

    const chapters = await this.store.getChapters();
    const existing = chapters[this._expandedIndex];
    if (!existing) return;

    // Сохранение inline-раздела альбома
    if (this._isAlbumBook() && this._inlineAlbumPages) {
      const sectionTitle = body.querySelector('.section-inline-title')?.value.trim() || '';
      const hideTitle = body.querySelector('.section-inline-hide-title')?.checked ?? true;

      const albumData = {
        title: sectionTitle,
        hideTitle,
        pages: structuredClone(this._album._albumPages),
      };

      // Сгенерировать HTML из альбомных данных
      const htmlContent = this._album._buildAlbumHtml(albumData);

      await this.store.updateChapter(this._expandedIndex, {
        ...existing,
        title: sectionTitle || existing.title,
        htmlContent,
        albumData,
      });
      this._renderJsonPreview();
      return;
    }

    // Обычная глава
    const idInput = body.querySelector('.chapter-inline-id');
    const titleInput = body.querySelector('.chapter-inline-title');
    const bgInput = body.querySelector('.chapter-inline-bg');
    const bgMobileInput = body.querySelector('.chapter-inline-bg-mobile');

    const id = idInput?.value.trim();
    const title = titleInput?.value.trim() || '';
    const bg = bgInput?.value.trim() || '';
    const bgMobile = bgMobileInput?.value.trim() || '';

    // Собрать контент из Quill, если в режиме редактора
    if (this._inputMode === 'editor' && this._editor.isInitialized && !this._editor.isEmpty()) {
      this._pendingHtmlContent = this._editor.getHTML();
    }

    const chapter = {
      id: id || existing.id,
      title,
      file: existing.file || '',
      bg,
      bgMobile,
    };

    if (this._pendingHtmlContent) {
      chapter.htmlContent = this._pendingHtmlContent;
    } else if (existing.htmlContent) {
      chapter.htmlContent = existing.htmlContent;
    }

    // Сохраняем albumData, если есть
    if (existing.albumData) {
      chapter.albumData = existing.albumData;
    }

    await this.store.updateChapter(this._expandedIndex, chapter);
    this._renderJsonPreview();
  }

  _destroyInlineEditor() {
    if (this._editor.isInitialized) {
      this._editor.destroy();
    }
    this._pendingHtmlContent = null;
  }

  // ═══════════════════════════════════════════
  // Legacy: модальное окно (для совместимости с тестами)
  // ═══════════════════════════════════════════

  /** @deprecated Используйте _toggleChapter() */
  async _openModal(editIndex = null) {
    // Перенаправляем на inline-редактирование
    if (editIndex !== null) {
      await this._toggleChapter(editIndex);
    } else {
      await this._addNewChapter();
    }
  }

  /** @deprecated */
  async _switchInputMode(mode) {
    this._inputMode = mode;
  }

  /** @deprecated */
  async _handleChapterSubmit(e) {
    if (e) e.preventDefault();
    await this._saveExpandedChapter();
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
