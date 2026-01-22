/**
 * ASYNC PAGINATOR
 * Разбивает HTML-контент на страницы с использованием CSS Multi-column layout.
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { sanitizer } from '../utils/HTMLSanitizer.js';
import { mediaQueries } from '../utils/MediaQueryManager.js';

export class AsyncPaginator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sanitizer = options.sanitizer || sanitizer;
    this.chunkSize = options.chunkSize || 5;
    this.yieldInterval = options.yieldInterval || 16;
    this.abortController = null;
  }

  async paginate(html, measureElement) {
    this.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const result = { pages: [], chapterStarts: [] };

    try {
      this.emit("start");

      // Санитизация
      this.emit("progress", { phase: "sanitize", progress: 0 });
      const sanitizedHtml = this.sanitizer.sanitize(html);
      await this._yieldToUI(signal);

      // Парсинг
      this.emit("progress", { phase: "parse", progress: 10 });
      const doc = new DOMParser().parseFromString(sanitizedHtml, "text/html");
      const articles = [...doc.querySelectorAll("article")];

      if (!articles.length) {
        console.warn("No articles found");
        return result;
      }

      await this._yieldToUI(signal);

      // Создание контейнера для измерений
      this.emit("progress", { phase: "layout", progress: 20 });
      const { container, cols, pageContent, pageWidth, pageHeight } =
        this._createPaginationContainer(measureElement);

      document.body.appendChild(container);

      try {
        // TOC
        this._addTOC(pageContent, articles);
        await this._yieldToUI(signal);

        // Статьи
        const isMobile = mediaQueries.get("mobile");
        const totalArticles = articles.length;

        for (let i = 0; i < totalArticles; i += this.chunkSize) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");

          const chunk = articles.slice(i, Math.min(i + this.chunkSize, totalArticles));
          this._addArticlesChunk(pageContent, chunk, i);

          const progress = 20 + Math.round((i / totalArticles) * 40);
          this.emit("progress", { phase: "content", progress });

          await this._yieldToUI(signal);
        }

        // Выравнивание глав
        if (!isMobile) {
          this.emit("progress", { phase: "align", progress: 65 });
          this._alignChapters(container, cols, pageWidth);
          await this._yieldToUI(signal);
        }

        // Главы
        this.emit("progress", { phase: "chapters", progress: 70 });
        result.chapterStarts = this._calculateChapterStarts(container, pageWidth);
        await this._yieldToUI(signal);

        // Нарезка
        this.emit("progress", { phase: "slice", progress: 75 });
        result.pages = await this._slicePagesAsync(
          cols, pageContent, pageWidth, pageHeight, signal
        );

      } finally {
        document.body.removeChild(container);
      }

      this.emit("progress", { phase: "complete", progress: 100 });
      this.emit("complete", result);

      return result;

    } catch (error) {
      if (error.name === "AbortError") {
        this.emit("abort");
        return result;
      }
      this.emit("error", error);
      throw error;
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async _yieldToUI(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const timeoutId = setTimeout(resolve, this.yieldInterval);

      signal?.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }

  _createPaginationContainer(measureElement) {
    const pageWidth = measureElement.clientWidth;
    const pageHeight = measureElement.clientHeight;

    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      left: -99999px;
      top: 0;
      height: ${pageHeight}px;
      overflow: visible;
    `;

    const cols = document.createElement("div");
    cols.style.cssText = `
      height: 100%;
      column-gap: 0;
      column-width: ${pageWidth}px;
      column-fill: auto;
    `;
    cols.className = "cols";

    const flow = document.createElement("div");
    const pageContent = document.createElement("div");
    pageContent.className = "page-content";

    flow.appendChild(pageContent);
    cols.appendChild(flow);
    container.appendChild(cols);

    return { container, cols, pageContent, pageWidth, pageHeight };
  }

  _addTOC(pageContent, articles) {
    const toc = document.createElement("section");
    toc.className = "toc";

    const tocTitle = document.createElement("h2");
    tocTitle.textContent = "Содержание";

    const tocList = document.createElement("ol");

    articles.forEach((article, i) => {
      const h = article.querySelector("h2");
      if (!h) return;

      const li = document.createElement("li");
      li.textContent = h.textContent;
      li.dataset.chapter = i;
      tocList.appendChild(li);
    });

    toc.appendChild(tocTitle);
    toc.appendChild(tocList);
    toc.style.breakAfter = "column";
    pageContent.appendChild(toc);
  }

  _addArticlesChunk(pageContent, articles, startIndex) {
    articles.forEach((article, i) => {
      const marker = document.createElement("div");
      marker.dataset.chapterStart = startIndex + i;
      marker.style.breakBefore = "column";
      pageContent.appendChild(marker);

      const clone = article.cloneNode(true);
      clone.removeAttribute("id");
      clone.style.margin = "0";
      pageContent.appendChild(clone);
    });
  }

  _alignChapters(container, cols, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];
    const colsRect = cols.getBoundingClientRect();

    markers.forEach((marker) => {
      const markerRect = marker.getBoundingClientRect();
      const colIndex = Math.floor((markerRect.left - colsRect.left) / pageWidth);

      if (colIndex % 2 !== 0) {
        const spacer = document.createElement("div");
        spacer.style.height = "100%";
        spacer.style.breakBefore = "column";
        marker.before(spacer);
      }
    });
  }

  _calculateChapterStarts(container, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];
    return markers.map(m => Math.floor(m.offsetLeft / pageWidth));
  }

  async _slicePagesAsync(cols, pageContent, pageWidth, pageHeight, signal) {
    const probe = document.createElement("div");
    probe.style.width = "1px";
    probe.style.height = pageHeight + "px";
    probe.style.breakBefore = "column";
    pageContent.appendChild(probe);

    const totalCols = Math.max(1, Math.ceil(cols.scrollWidth / pageWidth));
    const result = [];

    for (let i = 0; i < totalCols; i++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const snap = document.createElement("div");
      snap.style.cssText = `
        width: ${pageWidth}px;
        height: ${pageHeight}px;
        overflow: hidden;
      `;

      const clone = cols.cloneNode(true);
      clone.style.width = `${totalCols * pageWidth}px`;
      clone.style.transform = `translateX(${-i * pageWidth}px)`;

      snap.appendChild(clone);
      result.push(snap.innerHTML);

      if (i % this.chunkSize === 0) {
        this.emit("progress", {
          phase: "slice",
          progress: 75 + Math.round((i / totalCols) * 25)
        });
        await this._yieldToUI(signal);
      }
    }

    return result;
  }

  destroy() {
    this.abort();
    super.destroy();
  }
}
