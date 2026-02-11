/**
 * TESTS: ChaptersModule
 * Тесты для модуля управления главами, книгами и фотоальбомами
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChaptersModule } from '../../../js/admin/modules/ChaptersModule.js';

function createMockApp() {
  return {
    store: {
      getChapters: vi.fn(() => [
        { id: 'part_1', file: 'content/part_1.html', bg: 'bg1.webp', bgMobile: 'bg1-m.webp' },
        { id: 'part_2', file: 'content/part_2.html', bg: 'bg2.webp', bgMobile: 'bg2-m.webp' },
      ]),
      addChapter: vi.fn(),
      updateChapter: vi.fn(),
      removeChapter: vi.fn(),
      moveChapter: vi.fn(),
      getCover: vi.fn(() => ({ title: 'О хоббитах', author: 'Толкин', bg: 'cover.webp', bgMobile: 'cover-m.webp' })),
      updateCover: vi.fn(),
      getBooks: vi.fn(() => [
        { id: 'default', title: 'О хоббитах', author: 'Толкин', chaptersCount: 3 },
      ]),
      getActiveBookId: vi.fn(() => 'default'),
      setActiveBook: vi.fn(),
      addBook: vi.fn(),
      removeBook: vi.fn(),
      waitForSave: vi.fn().mockResolvedValue(undefined),
    },
    settings: { render: vi.fn() },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
    _render: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="chaptersList"></div>
    <div id="chaptersEmpty" hidden></div>
    <button id="addChapter"></button>
    <button id="addAlbum"></button>
    <div id="bookSelector"></div>
    <button id="deleteBook" hidden></button>
    <div id="bookSubtabs">
      <button class="book-subtab active" data-subtab="create">Create</button>
      <button class="book-subtab" data-subtab="upload">Upload</button>
    </div>
    <div class="book-subtab-content active" data-subtab-content="create"></div>
    <div class="book-subtab-content" data-subtab-content="upload" hidden></div>
    <div id="bookUploadArea">
      <div id="bookDropzone"></div>
      <input id="bookFileInput" type="file">
      <div id="bookUploadProgress" hidden></div>
      <span id="bookUploadStatus"></span>
      <div id="bookUploadResult" hidden></div>
      <span id="bookUploadTitle"></span>
      <span id="bookUploadAuthor"></span>
      <span id="bookUploadChaptersCount"></span>
      <button id="bookUploadConfirm"></button>
      <button id="bookUploadCancel"></button>
    </div>
    <input id="coverTitle" type="text">
    <input id="coverAuthor" type="text">
    <input id="coverBg" type="text">
    <input id="coverBgMobile" type="text">
    <button id="saveCover"></button>
    <dialog id="chapterModal">
      <h2 id="modalTitle"></h2>
      <form id="chapterForm">
        <input id="chapterId" type="text">
        <input id="chapterFile" type="text">
        <input id="chapterBg" type="text">
        <input id="chapterBgMobile" type="text">
        <button id="cancelModal" type="button"></button>
      </form>
    </dialog>
    <dialog id="albumModal">
      <form id="albumForm">
        <input id="albumTitle" type="text">
        <input id="albumHideTitle" type="checkbox">
        <div id="albumPages"></div>
        <button id="albumAddPage" type="button"></button>
        <button id="cancelAlbumModal" type="button"></button>
      </form>
    </dialog>
  `;
}

describe('ChaptersModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    document.querySelectorAll('dialog').forEach(d => {
      d.showModal = d.showModal || vi.fn();
      d.close = d.close || vi.fn();
    });
    app = createMockApp();
    mod = new ChaptersModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize state', () => {
      expect(mod._editingIndex).toBeNull();
      expect(mod._pendingParsedBook).toBeNull();
      expect(mod._albumPages).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderCover
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderCover()', () => {
    it('should populate cover fields from store', () => {
      mod._renderCover();

      expect(mod.coverTitle.value).toBe('О хоббитах');
      expect(mod.coverAuthor.value).toBe('Толкин');
      expect(mod.coverBgInput.value).toBe('cover.webp');
      expect(mod.coverBgMobileInput.value).toBe('cover-m.webp');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderChapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderChapters()', () => {
    it('should render chapter cards', () => {
      mod._renderChapters();

      const cards = mod.chaptersList.querySelectorAll('.chapter-card');
      expect(cards.length).toBe(2);
    });

    it('should show empty state when no chapters', () => {
      app.store.getChapters.mockReturnValue([]);

      mod._renderChapters();

      expect(mod.chaptersEmpty.hidden).toBe(false);
      expect(mod.chaptersList.innerHTML).toBe('');
    });

    it('should show chapter ID and file path', () => {
      mod._renderChapters();

      const titles = mod.chaptersList.querySelectorAll('.chapter-title');
      const metas = mod.chaptersList.querySelectorAll('.chapter-meta');
      expect(titles[0].textContent).toBe('part_1');
      expect(metas[0].textContent).toBe('content/part_1.html');
    });

    it('should show "Встроенный контент" for chapters with htmlContent', () => {
      app.store.getChapters.mockReturnValue([
        { id: 'album', file: '', htmlContent: '<article>...</article>', bg: '', bgMobile: '' },
      ]);

      mod._renderChapters();

      const meta = mod.chaptersList.querySelector('.chapter-meta');
      expect(meta.textContent).toBe('Встроенный контент');
    });

    it('should not show up button for first chapter', () => {
      mod._renderChapters();

      const upBtns = mod.chaptersList.querySelectorAll('[data-action="up"]');
      // First chapter has no up button, second has one
      expect(upBtns.length).toBe(1);
      expect(upBtns[0].dataset.index).toBe('1');
    });

    it('should not show down button for last chapter', () => {
      mod._renderChapters();

      const downBtns = mod.chaptersList.querySelectorAll('[data-action="down"]');
      expect(downBtns.length).toBe(1);
      expect(downBtns[0].dataset.index).toBe('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderBookSelector
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderBookSelector()', () => {
    it('should render book cards', () => {
      mod._renderBookSelector();

      const cards = mod.bookSelector.querySelectorAll('.book-card');
      expect(cards.length).toBe(1);
    });

    it('should mark active book', () => {
      mod._renderBookSelector();

      const activeCard = mod.bookSelector.querySelector('.book-card.active');
      expect(activeCard).not.toBeNull();
      expect(activeCard.dataset.bookId).toBe('default');
    });

    it('should hide delete button when only one book', () => {
      mod._renderBookSelector();
      expect(mod.deleteBookBtn.hidden).toBe(true);
    });

    it('should show delete button when multiple books', () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1', author: '', chaptersCount: 1 },
        { id: 'book2', title: 'Book 2', author: '', chaptersCount: 2 },
      ]);

      mod._renderBookSelector();

      expect(mod.deleteBookBtn.hidden).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _openModal
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_openModal()', () => {
    it('should open modal for new chapter', () => {
      const showModalSpy = vi.spyOn(mod.modal, 'showModal');

      mod._openModal();

      expect(mod._editingIndex).toBeNull();
      expect(mod.modalTitle.textContent).toBe('Добавить главу');
      expect(showModalSpy).toHaveBeenCalled();
    });

    it('should open modal for editing chapter', () => {
      mod._openModal(0);

      expect(mod._editingIndex).toBe(0);
      expect(mod.modalTitle.textContent).toBe('Редактировать главу');
      expect(mod.inputId.value).toBe('part_1');
      expect(mod.inputFile.value).toBe('content/part_1.html');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleChapterSubmit
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleChapterSubmit()', () => {
    it('should add new chapter', () => {
      mod.inputId.value = 'part_3';
      mod.inputFile.value = 'content/part_3.html';
      mod.inputBg.value = 'bg3.webp';
      mod.inputBgMobile.value = '';
      vi.spyOn(mod.modal, 'close');

      mod._handleChapterSubmit({ preventDefault: vi.fn() });

      expect(app.store.addChapter).toHaveBeenCalledWith({
        id: 'part_3',
        file: 'content/part_3.html',
        bg: 'bg3.webp',
        bgMobile: '',
      });
      expect(app._showToast).toHaveBeenCalledWith('Глава добавлена');
      expect(mod.modal.close).toHaveBeenCalled();
    });

    it('should update existing chapter in edit mode', () => {
      mod._editingIndex = 0;
      mod.inputId.value = 'part_1_updated';
      mod.inputFile.value = 'content/part_1_v2.html';
      mod.inputBg.value = '';
      mod.inputBgMobile.value = '';
      vi.spyOn(mod.modal, 'close');

      mod._handleChapterSubmit({ preventDefault: vi.fn() });

      expect(app.store.updateChapter).toHaveBeenCalledWith(0, expect.objectContaining({
        id: 'part_1_updated',
        file: 'content/part_1_v2.html',
      }));
      expect(app._showToast).toHaveBeenCalledWith('Глава обновлена');
    });

    it('should reject if id is empty', () => {
      mod.inputId.value = '';
      mod.inputFile.value = 'file.html';

      mod._handleChapterSubmit({ preventDefault: vi.fn() });

      expect(app.store.addChapter).not.toHaveBeenCalled();
    });

    it('should reject if both file and htmlContent are empty', () => {
      mod.inputId.value = 'test';
      mod.inputFile.value = '';

      mod._handleChapterSubmit({ preventDefault: vi.fn() });

      expect(app.store.addChapter).not.toHaveBeenCalled();
    });

    it('should preserve htmlContent when editing chapter without file', () => {
      app.store.getChapters.mockReturnValue([
        { id: 'album', file: '', htmlContent: '<article>...</article>', bg: '', bgMobile: '' },
      ]);
      mod._editingIndex = 0;
      mod.inputId.value = 'album_updated';
      mod.inputFile.value = '';
      mod.inputBg.value = '';
      mod.inputBgMobile.value = '';
      vi.spyOn(mod.modal, 'close');

      mod._handleChapterSubmit({ preventDefault: vi.fn() });

      const chapter = app.store.updateChapter.mock.calls[0][1];
      expect(chapter.htmlContent).toBe('<article>...</article>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveCover
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveCover()', () => {
    it('should save cover data to store', () => {
      mod.coverTitle.value = 'New Title';
      mod.coverAuthor.value = 'New Author';
      mod.coverBgInput.value = 'new-bg.webp';
      mod.coverBgMobileInput.value = 'new-bg-m.webp';

      mod._saveCover();

      expect(app.store.updateCover).toHaveBeenCalledWith({
        title: 'New Title',
        author: 'New Author',
        bg: 'new-bg.webp',
        bgMobile: 'new-bg-m.webp',
      });
      expect(app._showToast).toHaveBeenCalledWith('Обложка сохранена');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleSelectBook / _handleDeleteBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleSelectBook()', () => {
    it('should switch active book and re-render', () => {
      mod._handleSelectBook('book2');

      expect(app.store.setActiveBook).toHaveBeenCalledWith('book2');
      expect(app._render).toHaveBeenCalled();
    });

    it('should not switch if already active', () => {
      mod._handleSelectBook('default');

      expect(app.store.setActiveBook).not.toHaveBeenCalled();
    });
  });

  describe('_handleDeleteBook()', () => {
    it('should not delete last book', () => {
      mod._handleDeleteBook('default');

      expect(app._showToast).toHaveBeenCalledWith('Нельзя удалить единственную книгу');
      expect(app.store.removeBook).not.toHaveBeenCalled();
    });

    it('should delete book after confirmation', () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1' },
        { id: 'book2', title: 'Book 2' },
      ]);
      vi.spyOn(global, 'confirm').mockReturnValue(true);

      mod._handleDeleteBook('book2');

      expect(app.store.removeBook).toHaveBeenCalledWith('book2');
      expect(app._render).toHaveBeenCalled();

      global.confirm.mockRestore();
    });

    it('should not delete on cancel', () => {
      app.store.getBooks.mockReturnValue([
        { id: 'book1', title: 'Book 1' },
        { id: 'book2', title: 'Book 2' },
      ]);
      vi.spyOn(global, 'confirm').mockReturnValue(false);

      mod._handleDeleteBook('book2');

      expect(app.store.removeBook).not.toHaveBeenCalled();

      global.confirm.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _switchSubtab
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_switchSubtab()', () => {
    it('should switch active subtab', () => {
      mod._switchSubtab('upload');

      const uploadBtn = document.querySelector('[data-subtab="upload"]');
      const createBtn = document.querySelector('[data-subtab="create"]');
      expect(uploadBtn.classList.contains('active')).toBe(true);
      expect(createBtn.classList.contains('active')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTO ALBUM
  // ═══════════════════════════════════════════════════════════════════════════

  describe('photo album', () => {
    describe('_openAlbumModal()', () => {
      it('should initialize with one page and open modal', () => {
        const showModalSpy = vi.spyOn(mod.albumModal, 'showModal');

        mod._openAlbumModal();

        expect(mod._albumPages).toEqual([{ layout: '1', images: [] }]);
        expect(showModalSpy).toHaveBeenCalled();
      });
    });

    describe('_addAlbumPage()', () => {
      it('should add new page', () => {
        mod._albumPages = [{ layout: '1', images: [] }];
        mod._addAlbumPage();
        expect(mod._albumPages.length).toBe(2);
      });
    });

    describe('_removeAlbumPage()', () => {
      it('should remove page if more than one', () => {
        mod._albumPages = [{ layout: '1', images: [] }, { layout: '2', images: [] }];
        mod._removeAlbumPage(0);
        expect(mod._albumPages.length).toBe(1);
      });

      it('should not remove last page', () => {
        mod._albumPages = [{ layout: '1', images: [] }];
        mod._removeAlbumPage(0);
        expect(mod._albumPages.length).toBe(1);
      });
    });

    describe('_selectPageLayout()', () => {
      it('should update layout for page', () => {
        mod._albumPages = [{ layout: '1', images: [{ dataUrl: 'a', caption: '' }, { dataUrl: 'b', caption: '' }] }];
        mod._selectPageLayout(0, '1');
        // Layout '1' supports only 1 image, so images array is truncated
        expect(mod._albumPages[0].layout).toBe('1');
        expect(mod._albumPages[0].images.length).toBe(1);
      });

      it('should keep images that fit the layout', () => {
        mod._albumPages = [{ layout: '1', images: [{ dataUrl: 'a', caption: '' }] }];
        mod._selectPageLayout(0, '4');
        // Layout '4' supports 4 images, existing 1 should stay
        expect(mod._albumPages[0].images.length).toBe(1);
      });
    });

    describe('_buildAlbumHtml()', () => {
      it('should generate article HTML with title', () => {
        mod.albumHideTitle.checked = false;
        const pages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: 'My photo' }] }];

        const html = mod._buildAlbumHtml('Test Album', pages);

        expect(html).toContain('<article>');
        expect(html).toContain('<h2>Test Album</h2>');
        expect(html).toContain('data-layout="1"');
        expect(html).toContain('src="data:img"');
        expect(html).toContain('<figcaption>My photo</figcaption>');
      });

      it('should add sr-only class when title hidden', () => {
        mod.albumHideTitle.checked = true;
        const pages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: '' }] }];

        const html = mod._buildAlbumHtml('Hidden Title', pages);

        expect(html).toContain('class="sr-only"');
      });

      it('should handle pages with empty image slots', () => {
        mod.albumHideTitle.checked = false;
        const pages = [{ layout: '2', images: [null, { dataUrl: 'data:img', caption: '' }] }];

        const html = mod._buildAlbumHtml('Test', pages);

        // Null image produces empty src
        expect(html).toContain('src=""');
      });
    });

    describe('_handleAlbumSubmit()', () => {
      it('should add album chapter to store', () => {
        mod._albumPages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: 'Photo' }] }];
        mod.albumTitleInput.value = 'My Album';
        mod.albumHideTitle.checked = true;
        vi.spyOn(mod.albumModal, 'close');

        mod._handleAlbumSubmit({ preventDefault: vi.fn() });

        expect(app.store.addChapter).toHaveBeenCalledWith(expect.objectContaining({
          file: '',
          bg: '',
          bgMobile: '',
        }));
        const chapter = app.store.addChapter.mock.calls[0][0];
        expect(chapter.id).toMatch(/^album_\d+$/);
        expect(chapter.htmlContent).toContain('My Album');
        expect(app._showToast).toHaveBeenCalledWith('Фотоальбом добавлен');
      });

      it('should reject if title empty', () => {
        mod.albumTitleInput.value = '';
        mod._albumPages = [{ layout: '1', images: [{ dataUrl: 'data:img', caption: '' }] }];

        mod._handleAlbumSubmit({ preventDefault: vi.fn() });

        expect(app.store.addChapter).not.toHaveBeenCalled();
      });

      it('should reject if no images uploaded', () => {
        mod.albumTitleInput.value = 'Test';
        mod._albumPages = [{ layout: '1', images: [] }];

        mod._handleAlbumSubmit({ preventDefault: vi.fn() });

        expect(app._showToast).toHaveBeenCalledWith('Добавьте хотя бы одно изображение');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOK UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('book upload', () => {
    describe('_processBookFile()', () => {
      it('should reject unsupported formats', async () => {
        await mod._processBookFile({ name: 'book.pdf' });

        expect(app._showToast).toHaveBeenCalledWith('Допустимые форматы: .epub, .fb2, .docx, .doc, .txt');
      });
    });

    describe('_applyParsedBook()', () => {
      it('should do nothing without pending book', async () => {
        mod._pendingParsedBook = null;

        await mod._applyParsedBook();

        expect(app.store.addBook).not.toHaveBeenCalled();
      });

      it('should add parsed book to store', async () => {
        mod._pendingParsedBook = {
          title: 'Test Book',
          author: 'Test Author',
          chapters: [
            { id: 'ch1', title: 'Chapter 1', html: '<article>Content</article>' },
          ],
        };

        await mod._applyParsedBook();

        expect(app.store.addBook).toHaveBeenCalledWith(expect.objectContaining({
          cover: expect.objectContaining({
            title: 'Test Book',
            author: 'Test Author',
          }),
          chapters: expect.arrayContaining([
            expect.objectContaining({
              id: 'ch1',
              htmlContent: '<article>Content</article>',
            }),
          ]),
        }));
        expect(app.store.setActiveBook).toHaveBeenCalled();
        expect(app._render).toHaveBeenCalled();
      });

      it('should rollback on save failure', async () => {
        app.store.waitForSave.mockRejectedValue(new Error('quota'));
        mod._pendingParsedBook = {
          title: 'Big Book',
          author: '',
          chapters: [{ id: 'ch1', title: '', html: '<article>x</article>' }],
        };

        await mod._applyParsedBook();

        expect(app.store.removeBook).toHaveBeenCalled();
        expect(app._showToast).toHaveBeenCalledWith('Ошибка сохранения: недостаточно места в хранилище');
        expect(app.store.setActiveBook).not.toHaveBeenCalled();
      });
    });

    describe('_resetBookUpload()', () => {
      it('should reset upload state', () => {
        mod._pendingParsedBook = { some: 'data' };
        mod.bookDropzone.hidden = true;
        mod.bookUploadProgress.hidden = false;
        mod.bookUploadResult.hidden = false;

        mod._resetBookUpload();

        expect(mod._pendingParsedBook).toBeNull();
        expect(mod.bookDropzone.hidden).toBe(false);
        expect(mod.bookUploadProgress.hidden).toBe(true);
        expect(mod.bookUploadResult.hidden).toBe(true);
      });
    });
  });
});
