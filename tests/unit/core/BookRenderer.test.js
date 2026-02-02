/**
 * Unit tests for BookRenderer
 * Page rendering with double buffering and LRU cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookRenderer } from '../../../js/core/BookRenderer.js';

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

    it('should initialize empty page contents', () => {
      expect(renderer.pageContents).toEqual([]);
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

  describe('setPageContents', () => {
    it('should set page contents array', () => {
      const pages = [
        document.createElement('div'),
        document.createElement('div'),
      ];
      renderer.setPageContents(pages);
      expect(renderer.pageContents).toBe(pages);
    });

    it('should clear cache when setting new contents', () => {
      // First populate cache
      const pages = [document.createElement('div')];
      renderer.setPageContents(pages);
      renderer.getPageDOM(0); // This will populate cache
      expect(renderer.cacheSize).toBe(1);

      // Set new contents - should clear cache
      renderer.setPageContents([document.createElement('div')]);
      expect(renderer.cacheSize).toBe(0);
    });

    it('should not clear loadedImageUrls', () => {
      renderer.loadedImageUrls.add('http://example.com/image.jpg');
      renderer.setPageContents([]);
      expect(renderer.loadedImageUrls.has('http://example.com/image.jpg')).toBe(true);
    });
  });

  describe('getPageDOM', () => {
    let pages;

    beforeEach(() => {
      pages = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      pages[0].innerHTML = '<p>Page 1</p>';
      pages[1].innerHTML = '<p>Page 2</p>';
      pages[2].innerHTML = '<p>Page 3</p>';
      renderer.setPageContents(pages);
    });

    it('should return null for negative index', () => {
      expect(renderer.getPageDOM(-1)).toBeNull();
    });

    it('should return null for index beyond page count', () => {
      expect(renderer.getPageDOM(100)).toBeNull();
    });

    it('should return cloned DOM element', () => {
      const dom = renderer.getPageDOM(0);
      expect(dom).toBeInstanceOf(HTMLElement);
      expect(dom.innerHTML).toBe('<p>Page 1</p>');
      expect(dom).not.toBe(pages[0]); // Should be a clone
    });

    it('should cache DOM elements', () => {
      renderer.getPageDOM(0);
      expect(renderer.cacheSize).toBe(1);
    });

    it('should return cached element on subsequent calls', () => {
      const dom1 = renderer.getPageDOM(0);
      const dom2 = renderer.getPageDOM(0);
      // Both should have same content but be different clones
      expect(dom1.innerHTML).toBe(dom2.innerHTML);
      expect(dom1).not.toBe(dom2);
    });
  });

  describe('fill', () => {
    let pages;
    let container;

    beforeEach(() => {
      pages = [document.createElement('div')];
      pages[0].innerHTML = '<p>Content</p>';
      renderer.setPageContents(pages);

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
      expect(container.innerHTML).toContain('<p>Content</p>');
    });

    it('should clear container if page does not exist', () => {
      container.innerHTML = '<p>Old content</p>';
      renderer.fill(container, 100);
      expect(container.children.length).toBe(0);
    });

    it('should add page--toc class when page contains TOC', () => {
      pages[0].innerHTML = '<div class="toc">Table of Contents</div>';
      renderer.setPageContents(pages);
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
      // jsdom doesn't set complete properly, but we can test the logic
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

      // Simulate load event
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

      // Simulate error event
      img.dispatchEvent(new Event('error'));

      expect(img.dataset.loading).toBe('false');
    });
  });

  describe('renderSpread', () => {
    let pages;

    beforeEach(() => {
      pages = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      pages.forEach((p, i) => {
        p.innerHTML = `<p>Page ${i}</p>`;
      });
      renderer.setPageContents(pages);
    });

    it('should clear pages when no content', () => {
      renderer.setPageContents([]);
      renderer.renderSpread(0, false);
      expect(mockElements.leftActive.children.length).toBe(0);
      expect(mockElements.rightActive.children.length).toBe(0);
    });

    describe('desktop mode (isMobile=false)', () => {
      it('should render left and right pages', () => {
        renderer.renderSpread(0, false);
        expect(mockElements.leftActive.innerHTML).toContain('Page 0');
        expect(mockElements.rightActive.innerHTML).toContain('Page 1');
      });

      it('should render spread at index 2', () => {
        renderer.renderSpread(2, false);
        expect(mockElements.leftActive.innerHTML).toContain('Page 2');
        expect(mockElements.rightActive.innerHTML).toContain('Page 3');
      });
    });

    describe('mobile mode (isMobile=true)', () => {
      it('should clear left and show current page on right', () => {
        renderer.renderSpread(0, true);
        expect(mockElements.leftActive.children.length).toBe(0);
        expect(mockElements.rightActive.innerHTML).toContain('Page 0');
      });

      it('should show page at current index', () => {
        renderer.renderSpread(2, true);
        expect(mockElements.rightActive.innerHTML).toContain('Page 2');
      });
    });
  });

  describe('prepareBuffer', () => {
    let pages;

    beforeEach(() => {
      pages = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      pages.forEach((p, i) => {
        p.innerHTML = `<p>Page ${i}</p>`;
      });
      renderer.setPageContents(pages);
    });

    describe('desktop mode', () => {
      it('should prepare buffer with next spread', () => {
        renderer.prepareBuffer(2, false);
        expect(mockElements.leftBuffer.innerHTML).toContain('Page 2');
        expect(mockElements.rightBuffer.innerHTML).toContain('Page 3');
      });
    });

    describe('mobile mode', () => {
      it('should clear left buffer and fill right with page', () => {
        renderer.prepareBuffer(1, true);
        expect(mockElements.leftBuffer.children.length).toBe(0);
        expect(mockElements.rightBuffer.innerHTML).toContain('Page 1');
      });
    });
  });

  describe('prepareSheet', () => {
    let pages;

    beforeEach(() => {
      pages = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div'),
      ];
      pages.forEach((p, i) => {
        p.innerHTML = `<p>Page ${i}</p>`;
      });
      renderer.setPageContents(pages);
    });

    describe('mobile mode', () => {
      it('should fill sheet with current and next pages', () => {
        renderer.prepareSheet(0, 1, 'next', true);
        expect(mockElements.sheetFront.innerHTML).toContain('Page 0');
        expect(mockElements.sheetBack.innerHTML).toContain('Page 1');
      });
    });

    describe('desktop mode - next direction', () => {
      it('should fill sheet with right page of current spread and left of next', () => {
        renderer.prepareSheet(0, 2, 'next', false);
        // Front: currentIndex + 1 = 1
        // Back: currentIndex + 2 = 2
        expect(mockElements.sheetFront.innerHTML).toContain('Page 1');
        expect(mockElements.sheetBack.innerHTML).toContain('Page 2');
      });
    });

    describe('desktop mode - prev direction', () => {
      it('should fill sheet for prev direction', () => {
        renderer.prepareSheet(2, 0, 'prev', false);
        // Front: currentIndex = 2
        // Back: currentIndex - 1 = 1
        expect(mockElements.sheetFront.innerHTML).toContain('Page 2');
        expect(mockElements.sheetBack.innerHTML).toContain('Page 1');
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
      const pages = [document.createElement('div')];
      renderer.setPageContents(pages);
      renderer.getPageDOM(0);
      expect(renderer.cacheSize).toBe(1);

      renderer.clearCache();
      expect(renderer.cacheSize).toBe(0);
    });
  });

  describe('cacheSize', () => {
    it('should return current cache size', () => {
      expect(renderer.cacheSize).toBe(0);

      const pages = [
        document.createElement('div'),
        document.createElement('div'),
      ];
      renderer.setPageContents(pages);
      renderer.getPageDOM(0);
      renderer.getPageDOM(1);

      expect(renderer.cacheSize).toBe(2);
    });
  });

  describe('getMaxIndex', () => {
    beforeEach(() => {
      const pages = [];
      for (let i = 0; i < 10; i++) {
        pages.push(document.createElement('div'));
      }
      renderer.setPageContents(pages);
    });

    it('should return last index for mobile', () => {
      expect(renderer.getMaxIndex(true)).toBe(9);
    });

    it('should return last even index for desktop', () => {
      // 10 pages, last spread starts at index 8 (pages 8 and 9)
      expect(renderer.getMaxIndex(false)).toBe(8);
    });

    it('should return 0 for desktop with 1 page', () => {
      renderer.setPageContents([document.createElement('div')]);
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for desktop with 2 pages', () => {
      renderer.setPageContents([
        document.createElement('div'),
        document.createElement('div'),
      ]);
      expect(renderer.getMaxIndex(false)).toBe(0);
    });

    it('should return 0 for mobile with 1 page', () => {
      renderer.setPageContents([document.createElement('div')]);
      expect(renderer.getMaxIndex(true)).toBe(0);
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest entries when cache limit is reached', () => {
      // Cache limit is 5
      const pages = [];
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.innerHTML = `<p>Page ${i}</p>`;
        pages.push(p);
      }
      renderer.setPageContents(pages);

      // Access pages 0-5 to fill cache beyond limit
      for (let i = 0; i <= 5; i++) {
        renderer.getPageDOM(i);
      }

      // Cache should be at limit (5)
      expect(renderer.cacheSize).toBe(5);
    });
  });
});
