/**
 * BOOK RENDERER
 * Отвечает за рендеринг страниц в DOM.
 */

import { LRUCache } from '../utils/LRUCache.js';

export class BookRenderer {
  constructor(options) {
    this.cache = new LRUCache(options.cacheLimit || 12);
    this.pageContents = [];

    this.elements = {
      leftActive: options.leftActive,
      rightActive: options.rightActive,
      leftBuffer: options.leftBuffer,
      rightBuffer: options.rightBuffer,
      sheetFront: options.sheetFront,
      sheetBack: options.sheetBack,
    };
  }

  setPageContents(contents) {
    this.pageContents = contents;
    this.cache.clear();
  }

  getPageDOM(index) {
    if (index < 0 || index >= this.pageContents.length) {
      return null;
    }

    const cached = this.cache.get(index);
    if (cached) {
      return cached.cloneNode(true);
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = this.pageContents[index];
    const dom = wrapper.firstElementChild || wrapper;

    this.cache.set(index, dom.cloneNode(true));
    return dom;
  }

  fill(container, pageIndex) {
    if (!container) return;
    const dom = this.getPageDOM(pageIndex);

    if (dom) {
      container.replaceChildren(dom);
    } else {
      container.replaceChildren();
    }
  }

  renderSpread(index, isMobile) {
    const { leftActive, rightActive } = this.elements;

    if (!this.pageContents.length) {
      leftActive?.replaceChildren();
      rightActive?.replaceChildren();
      return;
    }

    if (isMobile) {
      leftActive?.replaceChildren();
      this.fill(rightActive, index);
    } else {
      this.fill(leftActive, index);
      this.fill(rightActive, index + 1);
    }
  }

  prepareBuffer(index, isMobile) {
    const { leftBuffer, rightBuffer } = this.elements;

    if (isMobile) {
      leftBuffer?.replaceChildren();
      this.fill(rightBuffer, index);
    } else {
      this.fill(leftBuffer, index);
      this.fill(rightBuffer, index + 1);
    }
  }

  prepareSheet(index, direction, isMobile) {
    const { sheetFront, sheetBack } = this.elements;

    if (isMobile) {
      if (direction === "next") {
        this.fill(sheetFront, index);
        this.fill(sheetBack, index + 1);
      } else {
        this.fill(sheetFront, index);
        this.fill(sheetBack, index - 1);
      }
    } else {
      if (direction === "next") {
        this.fill(sheetFront, index + 1);
        this.fill(sheetBack, index + 2);
      } else {
        this.fill(sheetFront, index);
        this.fill(sheetBack, index - 1);
      }
    }
  }

  swapBuffers() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.elements;

    leftActive.dataset.buffer = "true";
    rightActive.dataset.buffer = "true";
    leftActive.dataset.active = "false";
    rightActive.dataset.active = "false";

    leftBuffer.dataset.buffer = "false";
    rightBuffer.dataset.buffer = "false";
    leftBuffer.dataset.active = "true";
    rightBuffer.dataset.active = "true";

    this.elements.leftActive = leftBuffer;
    this.elements.leftBuffer = leftActive;
    this.elements.rightActive = rightBuffer;
    this.elements.rightBuffer = rightActive;
  }

  preloadPage(pageIndex) {
    if (!this.cache.has(pageIndex) && this.pageContents[pageIndex]) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = this.pageContents[pageIndex];
      const dom = wrapper.firstElementChild || wrapper;
      this.cache.set(pageIndex, dom);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  get cacheSize() {
    return this.cache.size;
  }

  getMaxIndex(isMobile) {
    const total = this.pageContents.length;
    return isMobile ? total - 1 : Math.max(0, total - 2);
  }
}
