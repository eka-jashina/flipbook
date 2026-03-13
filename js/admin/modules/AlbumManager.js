/**
 * Менеджер фотоальбомов
 * Управляет созданием и редактированием мульти-страничных фотоальбомов с раскладками.
 * Работает как полноэкранный вид (screen-view), а не модалка.
 *
 * Делегирует рендеринг, обработку изображений и генерацию HTML подмодулям:
 * - albumConstants.js      — константы и чистые утилиты
 * - AlbumPageRenderer.js   — рендеринг UI страниц и слотов
 * - AlbumImageProcessor.js — сжатие, кадрирование, поворот, массовая загрузка
 * - AlbumHtmlBuilder.js    — генерация HTML из структурированных данных
 */

import { t } from '@i18n';
import { PhotoCropper } from './PhotoCropper.js';
import { LAYOUT_IMAGE_COUNT, DEFAULT_FILTER_INTENSITY, getPageSlots, computeFilterStyle } from './albumConstants.js';
import { buildAlbumHtml, buildItemModifiers, buildImgInlineStyle, buildImgDataAttrs } from './AlbumHtmlBuilder.js';
import {
  compressImage, readPageImageFile, cropPageImage, resetCrop,
  rotatePageImage, bulkUpload, bulkUploadToPage,
  distributeBulkFiles, processBulkFiles,
} from './AlbumImageProcessor.js';
import {
  renderAlbumPages, buildLayoutButtons, buildOptionSelect,
  applyFilterPreview, getSlotElement,
} from './AlbumPageRenderer.js';

export class AlbumManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._albumPages = []; // [{ layout: '1', images: [{dataUrl, caption, frame, filter, filterIntensity}] }]
    /** @type {number|null} Индекс редактируемой главы (null = создание новой) */
    this._editingChapterIndex = null;
    /** @type {boolean} Были ли внесены изменения с момента открытия/сохранения */
    this._isDirty = false;
    this._cropper = new PhotoCropper();
  }

  get store() { return this._module.store; }

  cacheDOM() {
    this.albumTitleInput = document.getElementById('albumTitle');
    this.albumHideTitle = document.getElementById('albumHideTitle');
    this.albumPagesEl = document.getElementById('albumPages');
    this.albumAddPageBtn = document.getElementById('albumAddPage');
    this.albumBulkUploadBtn = document.getElementById('albumBulkUpload');
    this.saveAlbumBtn = document.getElementById('saveAlbum');
    this.cancelAlbumBtn = document.getElementById('cancelAlbum');
    this.albumHeading = document.getElementById('albumHeading');
  }

  bindEvents() {
    this.albumAddPageBtn.addEventListener('click', () => this._addAlbumPage());
    this.albumBulkUploadBtn.addEventListener('click', () => this._bulkUpload());
    this.saveAlbumBtn.addEventListener('click', () => this._handleAlbumSubmit());
    this.cancelAlbumBtn.addEventListener('click', () => this._cancelAlbum());
  }

  // ─── Открытие / закрытие ─────────────────────────────────────────────

  /** Открыть для создания нового альбома (вызывается из роутера) */
  openInView() {
    this._editingChapterIndex = null;
    this._isDirty = false;
    this._albumPages = [{ layout: '1', images: [] }];
    this.albumTitleInput.value = '';
    this.albumHideTitle.checked = true;
    this._updateUI();
    this._renderAlbumPages();
  }

  /** Открыть для редактирования существующего альбома */
  async openForEdit(chapterIndex) {
    this._editingChapterIndex = chapterIndex;
    this._isDirty = false;
    const chapters = await this.store.getChapters();
    const chapter = chapters[chapterIndex];
    if (!chapter?.albumData) return;

    const data = chapter.albumData;
    this.albumTitleInput.value = data.title || '';
    this.albumHideTitle.checked = data.hideTitle !== false;
    this._albumPages = structuredClone(data.pages) || [{ layout: '1', images: [] }];
    this._updateUI();
    this._renderAlbumPages();
  }

  /** Обновить UI в зависимости от режима (создание / редактирование) */
  _updateUI() {
    const isEditing = this._editingChapterIndex !== null;
    this.saveAlbumBtn.textContent = isEditing ? t('admin.album.saveButton') : t('admin.album.addButton');
    if (this.albumHeading) {
      this.albumHeading.textContent = isEditing ? t('admin.album.editHeading') : t('admin.album.addHeading');
    }
  }

  async _cancelAlbum() {
    if (this._isDirty) {
      const ok = await this._module._confirm(t('admin.album.unsavedConfirm'));
      if (!ok) return;
    }
    const app = this._module.app;
    const hadPending = !!app._pendingBookId;
    app._cleanupPendingBook();
    app._showView(hadPending ? 'bookshelf' : 'editor');
  }

  // ─── Управление страницами ──────────────────────────────────────────

  _addAlbumPage() {
    this._isDirty = true;
    this._albumPages.push({ layout: '1', images: [] });
    this._renderAlbumPages();
  }

  _removeAlbumPage(pageIndex) {
    if (this._albumPages.length <= 1) return;
    this._isDirty = true;
    this._albumPages.splice(pageIndex, 1);
    this._renderAlbumPages();
  }

  /** Переместить страницу вверх */
  _movePageUp(pageIndex) {
    if (pageIndex <= 0) return;
    this._isDirty = true;
    const pages = this._albumPages;
    [pages[pageIndex - 1], pages[pageIndex]] = [pages[pageIndex], pages[pageIndex - 1]];
    this._renderAlbumPages();
  }

  /** Переместить страницу вниз */
  _movePageDown(pageIndex) {
    if (pageIndex >= this._albumPages.length - 1) return;
    this._isDirty = true;
    const pages = this._albumPages;
    [pages[pageIndex], pages[pageIndex + 1]] = [pages[pageIndex + 1], pages[pageIndex]];
    this._renderAlbumPages();
  }

  async _selectPageLayout(pageIndex, layout) {
    const page = this._albumPages[pageIndex];
    const count = LAYOUT_IMAGE_COUNT[layout] || 1;

    // Проверить, будут ли потеряны загруженные фото
    const lostImages = page.images.slice(count).filter(img => img?.dataUrl);
    if (lostImages.length > 0) {
      const msg = lostImages.length === 1
        ? t('admin.album.layoutPhotoLoss_one', { count: 1 })
        : t('admin.album.layoutPhotoLoss_other', { count: lostImages.length });
      const ok = await this._module._confirm(msg);
      if (!ok) return;
    }

    this._isDirty = true;
    page.layout = layout;
    page.images = page.images.slice(0, count);

    this._renderAlbumPages();
  }

  /** Гарантировать наличие объекта изображения в слоте */
  _ensureImageData(page, index) {
    this._isDirty = true;
    if (!page.images[index]) {
      page.images[index] = { dataUrl: '', caption: '', frame: 'none', filter: 'none', filterIntensity: DEFAULT_FILTER_INTENSITY, rotation: 0 };
    }
  }

  // ─── Сохранение ─────────────────────────────────────────────────────

  async _handleAlbumSubmit() {
    const title = this.albumTitleInput.value.trim();
    if (!title) {
      this._module._showToast(t('admin.album.titleRequired'));
      return;
    }

    // Проверить, что хотя бы на одной странице есть изображение
    const hasAnyImage = this._albumPages.some(page =>
      page.images.some(img => img?.dataUrl)
    );
    if (!hasAnyImage) {
      this._module._showToast(t('admin.album.photoRequired'));
      return;
    }

    // Проверить незаполненные слоты
    let emptySlots = 0;
    for (const page of this._albumPages) {
      const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
      for (let i = 0; i < count; i++) {
        if (!page.images[i]?.dataUrl) emptySlots++;
      }
    }
    if (emptySlots > 0) {
      const msg = emptySlots === 1
        ? t('admin.album.emptySlotConfirm')
        : t('admin.album.emptySlotsConfirm', { count: emptySlots });
      const ok = await this._module._confirm(msg);
      if (!ok) return;
    }

    // Собрать структурированные данные альбома
    const albumData = {
      title,
      hideTitle: this.albumHideTitle.checked,
      pages: structuredClone(this._albumPages),
    };

    // Сгенерировать HTML из структурированных данных
    const htmlContent = this._buildAlbumHtml(albumData);

    if (this._editingChapterIndex !== null) {
      // Редактирование существующего альбома
      const chapters = await this.store.getChapters();
      const existing = chapters[this._editingChapterIndex];
      await this.store.updateChapter(this._editingChapterIndex, {
        ...existing,
        title: title,
        htmlContent,
        albumData,
      });
      this._module._showToast(t('admin.album.updated'));
    } else {
      // Создание нового альбома
      const chapterId = `album_${Date.now()}`;
      this.store.addChapter({
        id: chapterId,
        title: title,
        file: '',
        htmlContent,
        albumData,
        bg: '',
        bgMobile: '',
      });
      this._module._showToast(t('admin.album.added'));
    }

    this._isDirty = false;
    const app = this._module.app;

    // Если книга была создана как pending (из mode-selector), подтвердить её
    if (app._pendingBookId) {
      this.store.updateCover({ title });
      app._pendingBookId = null;
    }

    // Вернуться к редактору и обновить
    this._module._renderChapters();
    this._module._renderBookSelector();
    this._module._renderJsonPreview();
    app.openEditor();
  }

  // ─── Делегирование: рендеринг ─────────────────────────────────────

  _renderAlbumPages() { renderAlbumPages(this); }
  _buildLayoutButtons(layout) { return buildLayoutButtons(layout); }
  _buildOptionSelect(opts, activeId, cb) { return buildOptionSelect(opts, activeId, cb); }
  _applyFilterPreview(slot, img) { applyFilterPreview(slot, img); }
  _getSlotElement(pi, ii) { return getSlotElement(this, pi, ii); }
  _getPageSlots(page) { return getPageSlots(page); }

  // ─── Делегирование: обработка изображений ─────────────────────────

  _compressImage(file) { return compressImage(file); }
  _readPageImageFile(file, pi, ii) { return readPageImageFile(this, file, pi, ii); }
  _cropPageImage(pi, ii) { return cropPageImage(this, pi, ii); }
  _resetCrop(pi, ii) { resetCrop(this, pi, ii); }
  _rotatePageImage(pi, ii) { rotatePageImage(this, pi, ii); }
  _bulkUpload() { bulkUpload(this); }
  _bulkUploadToPage(pi) { bulkUploadToPage(this, pi); }
  _distributeBulkFiles(files) { return distributeBulkFiles(this, files); }
  _processBulkFiles(files, slots) { return processBulkFiles(this, files, slots); }

  // ─── Делегирование: генерация HTML ────────────────────────────────

  _buildAlbumHtml(data) { return buildAlbumHtml(data, (s) => this._module._escapeHtml(s)); }
  _buildItemModifiers(img) { return buildItemModifiers(img); }
  _buildImgInlineStyle(img) { return buildImgInlineStyle(img); }
  _buildImgDataAttrs(img) { return buildImgDataAttrs(img); }
  _computeFilterStyle(filter, intensity) { return computeFilterStyle(filter, intensity); }
}
