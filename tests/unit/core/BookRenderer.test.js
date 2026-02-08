/**
 * Unit tests for BookRenderer
 * Page rendering with double buffering, LRU cache, and lazy materialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookRenderer } from '../../../js/core/BookRenderer.js';

/**
 * Создать mock pageData для тестирования ленивой материализации.
 * Имитирует результат AsyncPaginator._buildPageData().
 */
function createMockPageData(pageCount, pageWidth = 400, pageHeight = 600) {
  const cols = document.createElement('div');
  cols.className = 'cols';

  const flow = document.createElement('div');
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';

  for (let i = 0; i < pageCount; i++) {
    const p = document.createElement('p');
    p.textContent = `Page ${i}`;
    pageContent.appendChild(p);
  }

  flow.appendChild(pageContent);
  cols.appendChild(flow);

  return { sourceElement: cols, pageCount, pageWidth, pageHeight };
}

describe('BookRenderer', () => {
  let renderer;
  let mockElements;

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      leftActive: document.createElement('div'),
      rightActive: document.createElement('div'),
      leftBuffer: document.createElement('div'),
      rightBuffer: document.createElement('div'),
      sheetFront: document.createElement('div'),
      sheetBack: document.createElement('div'),
    };

    // Wrap elements in pages for classList.toggle test
    Object.values(mockElements).forEach(el => {
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(el);
    });

    renderer = new BookRenderer({
      cacheLimit: 5,
      ...mockElements,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default cache limit if not provided', () => {
      const r = new BookRenderer({
        leftActive: mockElements.leftActive,
        rightActive: mockElements.rightActive,
        leftBuffer: mockElements.leftBuffer,
        rightBuffer: mockElements.rightBuffer,
        sheetFront: mockElements.sheetFront,
        sheetBack: mockElements.sheetBack,
      });
      expect(r.cacheSize).toBe(0);
    });

    it('should initialize with provided cache limit', () => {
      expect(renderer.cacheSize).toBe(0);
    });

    it('should initialize with zero total pages', () => {
      expect(renderer.totalPages).toBe(0);
    });

    it('should initialize empty loadedImageUrls set', () => {
      expect(renderer.loadedImageUrls).toBeInstanceOf(Set);
      expect(renderer.loadedImageUrls.size).toBe(0);
    });

    it('should store element references', () => {
      expect(renderer.elements.leftActive).toBe(mockElements.leftActive);
      expect(renderer.elements.rightActive).toBe(mockElements.rightActive);
    });
  });

  describe('setPaginationData', () => {
    it('should update totalPages from pagination data', () => {
      const pageData = createMockPageData(10);
      renderer.setPaginationData(pageData);
      expect(renderer.totalPages).toBe(10);
    });

    it('should clear cache when setting new data', () => {
      const pageData = createMockPageData(3);
      renderer.setPaginationData(pageData);
      renderer.getPageDOM(0);
      expect(renderer.cacheSize).toBe(1);

      renderer.setPaginationData(createMockPageData(5));
      expect(renderer.cacheSize).toBe(0);
    });

    it('should clear loadedImageUrls to prevent memory leaks', () => {
      renderer.loadedImageUrls.add('http://example.com/image.jpg');
      renderer.setPaginationData(null);
      expect(renderer.loadedImageUrls.size).toBe(0);
    });

    it('should handle null pageData', () => {
      renderer.setPaginationData(null);
      expect(renderer.totalPages).toBe(0);
    });
  });

  describe('getPageDOM', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(3));
    });

    it('should return null for negative index', () => {
      expect(renderer.getPageDOM(-1)).toBeNull();
    });

    it('should return null for index beyond page count', () => {
      expect(renderer.getPageDOM(100)).toBeNull();
    });

    it('should return a DOM element via lazy materialization', () => {
      const dom = renderer.getPageDOM(0);
      expect(dom).toBeInstanceOf(HTMLElement);
    });

    it('should return element with overflow:hidden viewport', () => {
      const dom = renderer.getPageDOM(0);
      expect(dom.style.overflow).toBe('hidden');
      expect(dom.style.width).toBe('400px');
      expect(dom.style.height).toBe('600px');
    });

    it('should cache DOM elements', () => {
      renderer.getPageDOM(0);
      expect(renderer.cacheSize).toBe(1);
    });

    it('should return different clones on subsequent calls', () => {
      const dom1 = renderer.getPageDOM(0);
      const dom2 = renderer.getPageDOM(0);
      expect(dom1.innerHTML).toBe(dom2.innerHTML);
      expect(dom1).not.toBe(dom2);
    });

    it('should return null when no pagination data', () => {
      renderer.setPaginationData(null);
      expect(renderer.getPageDOM(0)).toBeNull();
    });
  });

  describe('fill', () => {
    let container;

    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(3));

      container = document.createElement('div');
      const page = document.createElement('div');
      page.classList.add('page');
      page.appendChild(container);
    });

    it('should do nothing if container is null', () => {
      expect(() => renderer.fill(null, 0)).not.toThrow();
    });

    it('should fill container with page content', () => {
      renderer.fill(container, 0);
      expect(container.children.length).toBe(1);
    });

    it('should clear container if page does not exist', () => {
      container.innerHTML = '<p>Old content</p>';
      renderer.fill(container, 100);
      expect(container.children.length).toBe(0);
    });

    it('should add page--toc class when page contains TOC', () => {
      // Create pageData with TOC content
      const cols = document.createElement('div');
      const flow = document.createElement('div');
      const pageContent = document.createElement('div');
      pageContent.className = 'page-content';
      const toc = document.createElement('div');
      toc.className = 'toc';
      toc.textContent = 'Table of Contents';
      pageContent.appendChild(toc);
      flow.appendChild(pageContent);
      cols.appendChild(flow);

      renderer.setPaginationData({
        sourceElement: cols,
        pageCount: 1,
        pageWidth: 400,
        pageHeight: 600,
      });

      renderer.fill(container, 0);

      const page = container.closest('.page');
      expect(page.classList.contains('page--toc')).toBe(true);
    });

    it('should remove page--toc class when page has no TOC', () => {
      const page = container.closest('.page');
      page.classList.add('page--toc');

      renderer.fill(container, 0);
      expect(page.classList.contains('page--toc')).toBe(false);
    });
  });

  describe('_setupImageBlurPlaceholders', () => {
    it('should set data-loading="false" for already loaded images', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      img.src = 'http://example.com/loaded.jpg';
      renderer.loadedImageUrls.add('http://example.com/loaded.jpg');
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);
      expect(img.dataset.loading).toBe('false');
    });

    it('should set data-loading="true" for images being loaded', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/loading.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);
      expect(img.dataset.loading).toBe('true');
    });

    it('should add image URL to loadedImageUrls on load', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/new.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      img.dispatchEvent(new Event('load'));

      expect(renderer.loadedImageUrls.has('http://example.com/new.jpg')).toBe(true);
      expect(img.dataset.loading).toBe('false');
    });

    it('should handle error by setting data-loading="false"', () => {
      const container = document.createElement('div');
      const img = document.createElement('img');
      Object.defineProperty(img, 'complete', { value: false });
      img.src = 'http://example.com/error.jpg';
      container.appendChild(img);

      renderer._setupImageBlurPlaceholders(container);

      img.dispatchEvent(new Event('error'));

      expect(img.dataset.loading).toBe('false');
    });
  });

  describe('renderSpread', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    it('should clear pages when no content', () => {
      renderer.setPaginationData(null);
      renderer.renderSpread(0, false);
      expect(mockElements.leftActive.children.length).toBe(0);
      expect(mockElements.rightActive.children.length).toBe(0);
    });

    describe('desktop mode (isMobile=false)', () => {
      it('should render left and right pages', () => {
        renderer.renderSpread(0, false);
        expect(mockElements.leftActive.children.length).toBe(1);
        expect(mockElements.rightActive.children.length).toBe(1);
      });

      it('should render spread at index 2', () => {
        renderer.renderSpread(2, false);
        expect(mockElements.leftActive.children.length).toBe(1);
        expect(mockElements.rightActive.children.length).toBe(1);
      });
    });

    describe('mobile mode (isMobile=true)', () => {
      it('should clear left and show current page on right', () => {
        renderer.renderSpread(0, true);
        expect(mockElements.leftActive.children.length).toBe(0);
        expect(mockElements.rightActive.children.length).toBe(1);
      });

      it('should show page at current index', () => {
        renderer.renderSpread(2, true);
        expect(mockElements.rightActive.children.length).toBe(1);
      });
    });
  });

  describe('prepareBuffer', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    describe('desktop mode', () => {
      it('should prepare buffer with next spread', () => {
        renderer.prepareBuffer(2, false);
        expect(mockElements.leftBuffer.children.length).toBe(1);
        expect(mockElements.rightBuffer.children.length).toBe(1);
      });
    });

    describe('mobile mode', () => {
      it('should clear left buffer and fill right with page', () => {
        renderer.prepareBuffer(1, true);
        expect(mockElements.leftBuffer.children.length).toBe(0);
        expect(mockElements.rightBuffer.children.length).toBe(1);
      });
    });
  });

  describe('prepareSheet', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(4));
    });

    describe('mobile mode', () => {
      it('should fill sheet with current and next pages', () => {
        renderer.prepareSheet(0, 1, 'next', true);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });

    describe('desktop mode - next direction', () => {
      it('should fill sheet with right page of current spread and left of next', () => {
        renderer.prepareSheet(0, 2, 'next', false);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });

    describe('desktop mode - prev direction', () => {
      it('should fill sheet for prev direction', () => {
        renderer.prepareSheet(2, 0, 'prev', false);
        expect(mockElements.sheetFront.children.length).toBe(1);
        expect(mockElements.sheetBack.children.length).toBe(1);
      });
    });
  });

  describe('swapBuffers', () => {
    it('should swap active and buffer references', () => {
      const originalLeftActive = renderer.elements.leftActive;
      const originalRightActive = renderer.elements.rightActive;
      const originalLeftBuffer = renderer.elements.leftBuffer;
      const originalRightBuffer = renderer.elements.rightBuffer;

      renderer.swapBuffers();

      expect(renderer.elements.leftActive).toBe(originalLeftBuffer);
      expect(renderer.elements.rightActive).toBe(originalRightBuffer);
      expect(renderer.elements.leftBuffer).toBe(originalLeftActive);
      expect(renderer.elements.rightBuffer).toBe(originalRightActive);
    });

    it('should update data-buffer attributes', () => {
      renderer.swapBuffers();

      expect(mockElements.leftActive.dataset.buffer).toBe('true');
      expect(mockElements.rightActive.dataset.buffer).toBe('true');
      expect(mockElements.leftBuffer.dataset.buffer).toBe('false');
      expect(mockElements.rightBuffer.dataset.buffer).toBe('false');
    });

    it('should update data-active attributes', () => {
      renderer.swapBuffers();

      expect(mockElements.leftActive.dataset.active).toBe('false');
      expect(mockElements.rightActive.dataset.active).toBe('false');
      expect(mockElements.leftBuffer.dataset.active).toBe('true');
      expect(mockElements.rightBuffer.dataset.active).toBe('true');
    });
  });

  describe('clearCache', () => {
    it('should clear the LRU cache', () => {
      renderer.setPaginationData(createMockPageData(3));
      renderer.getPageDOM(0);
      expect(renderer.cacheSize).toBe(1);

      renderer.clearCache();
      expect(renderer.cacheSize).toBe(0);
    });
  });

  describe('cacheSize', () => {
    it('should return current cache size', () => {
      expect(renderer.cacheSize).toBe(0);

      renderer.setPaginationData(createMockPageData(3));
      renderer.getPageDOM(0);
      renderer.getPageDOM(1);

      expect(renderer.cacheSize).toBe(2);
    });
  });

  describe('getMaxIndex', () => {
    beforeEach(() => {
      renderer.setPaginationData(createMockPageData(10));
    });

    it('should return last index for mobile', () => {
      expect(renderer.getMaxIndex(true)).toBe(9);
    });

    it('should return last even index for desktop', () => {
      expect(renderer.getMaxIndex(false)).toBe(8);
    });

    it('should return 0 for desktop with 1 page', () => {
      renderer.setPaginationData(createMockPageData(1));
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for desktop with 2 pages', () => {
      renderer.setPaginationData(createMockPageData(2));
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for mobile with 1 page', () => {
      renderer.setPaginationData(createMockPageData(1));
      expect(renderer.getMaxIndex(true)).toBe(0);
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest entries when cache limit is reached', () => {
      renderer.setPaginationData(createMockPageData(10));

      for (let i = 0; i <= 5; i++) {
        renderer.getPageDOM(i);
      }

      expect(renderer.cacheSize).toBe(5);
    });
  });

  describe('totalPages', () => {
    it('should return 0 when no pagination data set', () => {
      expect(renderer.totalPages).toBe(0);
    });

    it('should return page count from pagination data', () => {
      renderer.setPaginationData(createMockPageData(42));
      expect(renderer.totalPages).toBe(42);
    });

    it('should return 0 after setting null pagination data', () => {
      renderer.setPaginationData(createMockPageData(10));
      renderer.setPaginationData(null);
      expect(renderer.totalPages).toBe(0);
    });
  });

  describe('_materializePage', () => {
    it('should return null when no source element', () => {
      expect(renderer._materializePage(0)).toBeNull();
    });

    it('should create viewport with correct dimensions', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      const page = renderer._materializePage(0);
      expect(page.style.width).toBe('300px');
      expect(page.style.height).toBe('500px');
      expect(page.style.overflow).toBe('hidden');
    });

    it('should set translateX based on page index', () => {
      renderer.setPaginationData(createMockPageData(5, 300, 500));
      const page = renderer._materializePage(2);
      const inner = page.firstChild;
      expect(inner.style.transform).toBe('translateX(-600px)');
    });
  });
});
