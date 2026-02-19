/**
 * Unit tests for AlbumManager
 * Управление фотоальбомами: страницы, layout, генерация HTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlbumManager } from '../../../js/admin/modules/AlbumManager.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Реальное экранирование — важно для XSS-тестов
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Мок ChaptersModule — минимальный интерфейс, нужный AlbumManager
 */
function createMockModule() {
  return {
    store: {
      addChapter: vi.fn(),
    },
    app: {
      _showView: vi.fn(),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => escapeHtml(s)),
    _renderChapters: vi.fn(),
    _renderJsonPreview: vi.fn(),
  };
}

/**
 * DOM-минимум для AlbumManager.cacheDOM() и bindEvents()
 */
function setupDOM() {
  document.body.innerHTML = `
    <input id="albumTitle" type="text">
    <input id="albumHideTitle" type="checkbox">
    <div id="albumPages"></div>
    <button id="albumAddPage" type="button"></button>
    <button id="saveAlbum" type="button"></button>
    <button id="cancelAlbum" type="button"></button>
  `;
}

/**
 * Создать страницу с указанным layout и N изображениями
 */
function makePage(layout = '1', images = []) {
  return { layout, images };
}

/**
 * Создать объект изображения
 */
function makeImage(dataUrl = 'data:image/png;base64,abc', caption = '') {
  return { dataUrl, caption };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('AlbumManager', () => {
  let mockModule;
  let manager;

  beforeEach(() => {
    setupDOM();
    mockModule = createMockModule();
    manager = new AlbumManager(mockModule);
    manager.cacheDOM();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should store the module reference', () => {
      expect(manager._module).toBe(mockModule);
    });

    it('should initialize _albumPages as an empty array', () => {
      expect(manager._albumPages).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // get store()
  // ─────────────────────────────────────────────────────────────────────────

  describe('get store()', () => {
    it('should return the module store', () => {
      expect(manager.store).toBe(mockModule.store);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cacheDOM()
  // ─────────────────────────────────────────────────────────────────────────

  describe('cacheDOM()', () => {
    it('should cache albumTitleInput', () => {
      expect(manager.albumTitleInput).toBe(document.getElementById('albumTitle'));
    });

    it('should cache albumHideTitle checkbox', () => {
      expect(manager.albumHideTitle).toBe(document.getElementById('albumHideTitle'));
    });

    it('should cache albumPagesEl', () => {
      expect(manager.albumPagesEl).toBe(document.getElementById('albumPages'));
    });

    it('should cache albumAddPageBtn', () => {
      expect(manager.albumAddPageBtn).toBe(document.getElementById('albumAddPage'));
    });

    it('should cache saveAlbumBtn', () => {
      expect(manager.saveAlbumBtn).toBe(document.getElementById('saveAlbum'));
    });

    it('should cache cancelAlbumBtn', () => {
      expect(manager.cancelAlbumBtn).toBe(document.getElementById('cancelAlbum'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // openInView()
  // ─────────────────────────────────────────────────────────────────────────

  describe('openInView()', () => {
    beforeEach(() => {
      manager.openInView();
    });

    it('should reset _albumPages to one empty page', () => {
      expect(manager._albumPages).toHaveLength(1);
    });

    it('should set the default layout to "1"', () => {
      expect(manager._albumPages[0].layout).toBe('1');
    });

    it('should initialize images as an empty array', () => {
      expect(manager._albumPages[0].images).toEqual([]);
    });

    it('should clear the title input', () => {
      manager.albumTitleInput.value = 'Старое название';
      manager.openInView();
      expect(manager.albumTitleInput.value).toBe('');
    });

    it('should check the hideTitle checkbox', () => {
      manager.albumHideTitle.checked = false;
      manager.openInView();
      expect(manager.albumHideTitle.checked).toBe(true);
    });

    it('should render the page into the DOM', () => {
      expect(manager.albumPagesEl.querySelector('.album-page-card')).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD: _addAlbumPage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_addAlbumPage()', () => {
    beforeEach(() => {
      manager._albumPages = [makePage()];
    });

    it('should increase _albumPages length by 1', () => {
      manager._addAlbumPage();
      expect(manager._albumPages).toHaveLength(2);
    });

    it('should add a page with default layout "1"', () => {
      manager._addAlbumPage();
      expect(manager._albumPages[1].layout).toBe('1');
    });

    it('should add a page with an empty images array', () => {
      manager._addAlbumPage();
      expect(manager._albumPages[1].images).toEqual([]);
    });

    it('should call _renderAlbumPages after adding', () => {
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._addAlbumPage();
      expect(spy).toHaveBeenCalled();
    });

    it('should be additive — multiple calls accumulate pages', () => {
      manager._addAlbumPage();
      manager._addAlbumPage();
      expect(manager._albumPages).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD: _removeAlbumPage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_removeAlbumPage()', () => {
    it('should remove the page at the given index', () => {
      manager._albumPages = [makePage('1'), makePage('2')];
      manager._removeAlbumPage(0);
      expect(manager._albumPages).toHaveLength(1);
      expect(manager._albumPages[0].layout).toBe('2');
    });

    it('should remove the last (second) page by index', () => {
      manager._albumPages = [makePage('1'), makePage('2')];
      manager._removeAlbumPage(1);
      expect(manager._albumPages).toHaveLength(1);
      expect(manager._albumPages[0].layout).toBe('1');
    });

    it('should NOT remove when only one page remains', () => {
      manager._albumPages = [makePage()];
      manager._removeAlbumPage(0);
      expect(manager._albumPages).toHaveLength(1);
    });

    it('should call _renderAlbumPages after successful removal', () => {
      manager._albumPages = [makePage(), makePage()];
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._removeAlbumPage(0);
      expect(spy).toHaveBeenCalled();
    });

    it('should NOT call _renderAlbumPages when removal is blocked', () => {
      manager._albumPages = [makePage()];
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._removeAlbumPage(0);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD: _selectPageLayout() (updateLayout)
  // ─────────────────────────────────────────────────────────────────────────

  describe('_selectPageLayout()', () => {
    beforeEach(() => {
      manager._albumPages = [makePage('1', [makeImage()])];
    });

    it('should update the page layout', () => {
      manager._selectPageLayout(0, '2');
      expect(manager._albumPages[0].layout).toBe('2');
    });

    it('should trim images when switching to a smaller layout', () => {
      manager._albumPages = [makePage('4', [
        makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d'),
      ])];
      manager._selectPageLayout(0, '1'); // layout '1' → count=1
      expect(manager._albumPages[0].images).toHaveLength(1);
    });

    it('should keep existing images when switching to a larger layout', () => {
      manager._albumPages = [makePage('1', [makeImage('img1')])];
      manager._selectPageLayout(0, '4'); // layout '4' → count=4
      // slice(0, 4) on a 1-item array yields 1 item
      expect(manager._albumPages[0].images).toHaveLength(1);
    });

    it('should preserve remaining images when trimming', () => {
      manager._albumPages = [makePage('4', [
        makeImage('keep'), makeImage('drop'), makeImage('drop'), makeImage('drop'),
      ])];
      manager._selectPageLayout(0, '1');
      expect(manager._albumPages[0].images[0].dataUrl).toBe('keep');
    });

    it('should call _renderAlbumPages after layout change', () => {
      const spy = vi.spyOn(manager, '_renderAlbumPages');
      manager._selectPageLayout(0, '2');
      expect(spy).toHaveBeenCalled();
    });

    it('should handle unknown layout id by defaulting to count=1', () => {
      manager._albumPages = [makePage('unknown', [makeImage('a'), makeImage('b')])];
      manager._selectPageLayout(0, 'unknown');
      expect(manager._albumPages[0].images).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // рендеринг страниц: _renderAlbumPages()
  // ─────────────────────────────────────────────────────────────────────────

  describe('рендеринг страниц', () => {
    describe('пустой альбом (нет страниц)', () => {
      it('should produce no cards when _albumPages is empty', () => {
        manager._albumPages = [];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(0);
      });
    });

    describe('одна страница', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1')];
        manager._renderAlbumPages();
      });

      it('should render one card', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(1);
      });

      it('should show "Страница 1" as page title', () => {
        const title = manager.albumPagesEl.querySelector('.album-page-title');
        expect(title.textContent).toBe('Страница 1');
      });

      it('should NOT show the remove button for a single page', () => {
        expect(manager.albumPagesEl.querySelector('.album-page-remove')).toBeNull();
      });

      it('should render layout buttons', () => {
        expect(manager.albumPagesEl.querySelector('.album-layouts')).not.toBeNull();
      });
    });

    describe('несколько страниц', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1'), makePage('2')];
        manager._renderAlbumPages();
      });

      it('should render two cards', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(2);
      });

      it('should show remove button on each card', () => {
        expect(manager.albumPagesEl.querySelectorAll('.album-page-remove')).toHaveLength(2);
      });

      it('should show sequential page numbers', () => {
        const titles = manager.albumPagesEl.querySelectorAll('.album-page-title');
        expect(titles[0].textContent).toBe('Страница 1');
        expect(titles[1].textContent).toBe('Страница 2');
      });
    });

    describe('страница с layout "1" → 1 слот', () => {
      it('should render exactly 1 image slot', () => {
        manager._albumPages = [makePage('1')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(1);
      });
    });

    describe('страница с layout "2" → 2 слота', () => {
      it('should render exactly 2 image slots', () => {
        manager._albumPages = [makePage('2')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(2);
      });
    });

    describe('страница с layout "3"', () => {
      it('should render exactly 3 image slots', () => {
        manager._albumPages = [makePage('3')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(3);
      });
    });

    describe('страница с layout "4"', () => {
      it('should render exactly 4 image slots', () => {
        manager._albumPages = [makePage('4')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-image-slot')).toHaveLength(4);
      });
    });

    describe('слот с изображением', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        manager._renderAlbumPages();
      });

      it('should add has-image class to the slot', () => {
        const slot = manager.albumPagesEl.querySelector('.album-image-slot');
        expect(slot.classList.contains('has-image')).toBe(true);
      });

      it('should render an img element with the correct src', () => {
        const img = manager.albumPagesEl.querySelector('.album-image-slot-img');
        expect(img).not.toBeNull();
        expect(img.src).toContain('data:image/png');
      });

      it('should pre-fill caption input with image caption', () => {
        manager._albumPages = [makePage('1', [makeImage('data:image/png;base64,abc', 'Закат')])];
        manager._renderAlbumPages();
        const captionInput = manager.albumPagesEl.querySelector('.album-image-slot-caption');
        expect(captionInput.value).toBe('Закат');
      });
    });

    describe('слот без изображения', () => {
      beforeEach(() => {
        manager._albumPages = [makePage('1', [])];
        manager._renderAlbumPages();
      });

      it('should NOT add has-image class to the slot', () => {
        const slot = manager.albumPagesEl.querySelector('.album-image-slot');
        expect(slot.classList.contains('has-image')).toBe(false);
      });

      it('should NOT render an img element', () => {
        expect(manager.albumPagesEl.querySelector('.album-image-slot-img')).toBeNull();
      });

      it('should render a placeholder element', () => {
        expect(manager.albumPagesEl.querySelector('.album-image-slot-placeholder')).not.toBeNull();
      });
    });

    describe('перерендеринг очищает старый DOM', () => {
      it('should replace previous cards on re-render', () => {
        manager._albumPages = [makePage('1'), makePage('2')];
        manager._renderAlbumPages();
        manager._albumPages = [makePage('3')];
        manager._renderAlbumPages();
        expect(manager.albumPagesEl.querySelectorAll('.album-page-card')).toHaveLength(1);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _buildLayoutButtons()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_buildLayoutButtons()', () => {
    it('should generate 8 layout buttons', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      expect(div.querySelectorAll('[data-layout]')).toHaveLength(8);
    });

    it('should mark exactly one button as active', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('2');
      expect(div.querySelectorAll('.active')).toHaveLength(1);
    });

    it('should mark the correct layout as active', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('3');
      const active = div.querySelector('.active');
      expect(active.dataset.layout).toBe('3');
    });

    it('should generate correct icon count for layout "1" (1 icon)', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      const btn = div.querySelector('[data-layout="1"]');
      expect(btn.querySelectorAll('i')).toHaveLength(1);
    });

    it('should generate correct icon count for layout "4" (4 icons)', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('4');
      const btn = div.querySelector('[data-layout="4"]');
      expect(btn.querySelectorAll('i')).toHaveLength(4);
    });

    it('should set data-layout attribute on each button', () => {
      const div = document.createElement('div');
      div.innerHTML = manager._buildLayoutButtons('1');
      const layouts = Array.from(div.querySelectorAll('[data-layout]')).map(b => b.dataset.layout);
      expect(layouts).toContain('1');
      expect(layouts).toContain('2');
      expect(layouts).toContain('2h');
      expect(layouts).toContain('4');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // генерация HTML: _buildAlbumHtml()
  // ─────────────────────────────────────────────────────────────────────────

  describe('генерация HTML (_buildAlbumHtml)', () => {
    beforeEach(() => {
      manager.albumHideTitle.checked = false; // заголовок виден по умолчанию
    });

    it('should wrap output in <article>', () => {
      const html = manager._buildAlbumHtml('T', [makePage()]);
      expect(html).toMatch(/^<article>/);
      expect(html).toMatch(/<\/article>$/);
    });

    it('should include <h2> with album title', () => {
      const html = manager._buildAlbumHtml('Горный поход', [makePage()]);
      expect(html).toContain('<h2>Горный поход</h2>');
    });

    it('should NOT add class to h2 when hideTitle is false', () => {
      const html = manager._buildAlbumHtml('Название', [makePage()]);
      expect(html).not.toContain('sr-only');
    });

    it('should add class="sr-only" to h2 when hideTitle is checked', () => {
      manager.albumHideTitle.checked = true;
      const html = manager._buildAlbumHtml('Название', [makePage()]);
      expect(html).toContain('class="sr-only"');
    });

    it('should include div.photo-album with correct data-layout', () => {
      const html = manager._buildAlbumHtml('T', [makePage('2h')]);
      expect(html).toContain('data-layout="2h"');
    });

    describe('без изображений → placeholder figures', () => {
      it('should generate placeholder figure when image slot contains null', () => {
        // _buildAlbumHtml maps over page.images; an explicit null entry → placeholder
        const html = manager._buildAlbumHtml('T', [makePage('1', [null])]);
        expect(html).toContain('<figure class="photo-album__item"><img src="" alt=""></figure>');
      });

      it('should generate placeholder figure for null image slot', () => {
        const html = manager._buildAlbumHtml('T', [makePage('1', [null])]);
        expect(html).toContain('<figure class="photo-album__item"><img src="" alt=""></figure>');
      });

      it('should generate one placeholder per explicit null entry', () => {
        // Two null slots → two placeholder figures
        const html = manager._buildAlbumHtml('T', [makePage('2', [null, null])]);
        const matches = html.match(/<figure class="photo-album__item"><img src="" alt=""><\/figure>/g);
        expect(matches).toHaveLength(2);
      });
    });

    describe('с изображениями → img с dataUrl', () => {
      it('should embed the dataUrl in the img src', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).toContain('src="data:image/png;base64,abc"');
      });

      it('should NOT generate a placeholder figure when an image is present', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).not.toContain('<img src="" alt="">');
      });

      it('should include figcaption when caption is set', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', 'Закат')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).toContain('<figcaption>Закат</figcaption>');
      });

      it('should NOT include figcaption when caption is empty', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).not.toContain('<figcaption>');
      });

      it('should only include images up to the layout count', () => {
        // layout '1' → count=1, дополнительное изображение отбрасывается
        const pages = [makePage('1', [makeImage('first'), makeImage('second')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).toContain('first');
        expect(html).not.toContain('second');
      });
    });

    describe('caption экранируется (XSS)', () => {
      it('should escape < and > in caption', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '<b>bold</b>')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;b&gt;');
      });

      it('should escape <script> injection in caption', () => {
        const xss = '<script>alert("xss")</script>';
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', xss)])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('should escape quotes in caption (used in alt attribute)', () => {
        const pages = [makePage('1', [makeImage('data:image/png;base64,abc', '"quoted"')])];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).not.toContain('"quoted"');
        expect(html).toContain('&quot;quoted&quot;');
      });

      it('should escape title for XSS protection', () => {
        const html = manager._buildAlbumHtml('<script>alert(1)</script>', [makePage()]);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });
    });

    describe('несколько страниц', () => {
      it('should generate one photo-album div per page', () => {
        const pages = [makePage('1'), makePage('2')];
        const html = manager._buildAlbumHtml('T', pages);
        const matches = html.match(/class="photo-album"/g);
        expect(matches).toHaveLength(2);
      });

      it('should preserve each page data-layout', () => {
        const pages = [makePage('1'), makePage('4')];
        const html = manager._buildAlbumHtml('T', pages);
        expect(html).toContain('data-layout="1"');
        expect(html).toContain('data-layout="4"');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _handleAlbumSubmit()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_handleAlbumSubmit()', () => {
    beforeEach(() => {
      manager.albumHideTitle.checked = false;
    });

    it('should show a toast and abort when title is empty', () => {
      manager.albumTitleInput.value = '';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule._showToast).toHaveBeenCalled();
      expect(mockModule.store.addChapter).not.toHaveBeenCalled();
    });

    it('should show a toast and abort when title is only whitespace', () => {
      manager.albumTitleInput.value = '   ';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule._showToast).toHaveBeenCalled();
      expect(mockModule.store.addChapter).not.toHaveBeenCalled();
    });

    it('should show a toast and abort when no images are present', () => {
      manager.albumTitleInput.value = 'Мой альбом';
      manager._albumPages = [makePage('1', [])];
      manager._handleAlbumSubmit();
      expect(mockModule._showToast).toHaveBeenCalled();
      expect(mockModule.store.addChapter).not.toHaveBeenCalled();
    });

    it('should show a toast and abort when images are all null', () => {
      manager.albumTitleInput.value = 'Мой альбом';
      manager._albumPages = [makePage('1', [null])];
      manager._handleAlbumSubmit();
      expect(mockModule._showToast).toHaveBeenCalled();
      expect(mockModule.store.addChapter).not.toHaveBeenCalled();
    });

    it('should call store.addChapter once on valid input', () => {
      manager.albumTitleInput.value = 'Мой альбом';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule.store.addChapter).toHaveBeenCalledOnce();
    });

    it('should include generated HTML in the chapter data', () => {
      manager.albumTitleInput.value = 'Мой альбом';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      const arg = mockModule.store.addChapter.mock.calls[0][0];
      expect(arg.htmlContent).toContain('<article>');
    });

    it('should generate a chapter id starting with "album_"', () => {
      manager.albumTitleInput.value = 'Тест';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      const arg = mockModule.store.addChapter.mock.calls[0][0];
      expect(arg.id).toMatch(/^album_/);
    });

    it('should call _renderChapters after save', () => {
      manager.albumTitleInput.value = 'Тест';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule._renderChapters).toHaveBeenCalled();
    });

    it('should navigate to editor view after save', () => {
      manager.albumTitleInput.value = 'Тест';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule.app._showView).toHaveBeenCalledWith('editor');
    });

    it('should show a success toast after save', () => {
      manager.albumTitleInput.value = 'Тест';
      manager._albumPages = [makePage('1', [makeImage()])];
      manager._handleAlbumSubmit();
      expect(mockModule._showToast).toHaveBeenCalled();
    });
  });
});
