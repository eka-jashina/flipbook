/**
 * ASYNC PAGINATOR
 * Разбивает HTML-контент на страницы с использованием CSS Multi-column layout.
 *
 * Алгоритм работы:
 * 1. Санитизация HTML (защита от XSS)
 * 2. Парсинг и извлечение статей (article)
 * 3. Создание скрытого контейнера с CSS multi-column
 * 4. Добавление оглавления (TOC) и контента по чанкам
 * 5. Выравнивание глав по чётным страницам (desktop)
 * 6. Нарезка на отдельные страницы
 *
 * @fires AsyncPaginator#start - Начало пагинации
 * @fires AsyncPaginator#progress - Прогресс {phase, progress}
 * @fires AsyncPaginator#complete - Завершение {pages, chapterStarts}
 * @fires AsyncPaginator#abort - Отмена операции
 * @fires AsyncPaginator#error - Ошибка
 *
 * @extends EventEmitter
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { sanitizer } from '../utils/HTMLSanitizer.js';
import { mediaQueries } from '../utils/MediaQueryManager.js';

/**
 * @typedef {Object} PaginationResult
 * @property {HTMLElement[]} pages - DOM-элементы для каждой страницы
 * @property {number[]} chapterStarts - Индексы страниц, с которых начинаются главы
 */

/**
 * @typedef {Object} PaginatorOptions
 * @property {Object} [sanitizer] - Кастомный санитайзер HTML
 * @property {number} [chunkSize=5] - Количество статей, обрабатываемых за один yield
 * @property {number} [yieldInterval=16] - Интервал yield в мс (~1 кадр при 60fps)
 */

export class AsyncPaginator extends EventEmitter {
  /**
   * Создаёт асинхронный пагинатор
   * @param {PaginatorOptions} [options={}] - Опции конфигурации
   */
  constructor(options = {}) {
    super();
    /** @type {Object} Санитайзер для HTML */
    this.sanitizer = options.sanitizer || sanitizer;
    /** @type {number} Размер чанка для обработки */
    this.chunkSize = options.chunkSize || 5;
    /** @type {number} Интервал yield для UI responsiveness */
    this.yieldInterval = options.yieldInterval || 16;
    /** @type {AbortController|null} Контроллер для отмены операции */
    this.abortController = null;
  }

  /**
   * Разбить HTML-контент на страницы
   *
   * Асинхронно обрабатывает HTML, периодически возвращая управление
   * браузеру для поддержания отзывчивости UI.
   *
   * @param {string} html - HTML-контент для пагинации (должен содержать article элементы)
   * @param {HTMLElement} measureElement - Элемент для измерения размеров страницы
   * @returns {Promise<PaginationResult>} Результат пагинации
   * @throws {Error} При ошибке обработки (кроме AbortError)
   *
   * @example
   * const paginator = new AsyncPaginator();
   * paginator.on('progress', ({phase, progress}) => updateUI(progress));
   * const {pages, chapterStarts} = await paginator.paginate(html, pageElement);
   */
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
        // Оглавление
        this._addTOC(pageContent, articles);
        await this._yieldToUI(signal);

        // Статьи
        const isMobile = mediaQueries.isMobile;
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

  /**
   * Отменить текущую операцию пагинации
   *
   * Если пагинация выполняется, она будет прервана и вызовет событие 'abort'.
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Передать управление браузеру для обновления UI
   *
   * Используется для предотвращения блокировки главного потока
   * при длительных операциях.
   *
   * @param {AbortSignal} [signal] - Сигнал для отмены
   * @returns {Promise<void>}
   * @throws {DOMException} AbortError при отмене
   * @private
   */
  async _yieldToUI(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      };

      const timeoutId = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, this.yieldInterval);

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Создать контейнер для измерения пагинации
   *
   * Создаёт скрытый off-screen контейнер с CSS multi-column layout
   * для расчёта разбиения контента на страницы.
   *
   * @param {HTMLElement} measureElement - Элемент-образец для размеров страницы
   * @returns {{container: HTMLDivElement, cols: HTMLDivElement, pageContent: HTMLDivElement, pageWidth: number, pageHeight: number}}
   * @private
   */
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

  /**
   * Добавить оглавление (Table of Contents)
   *
   * Создаёт секцию с заголовками всех глав в виде нумерованного списка.
   * Оглавление занимает отдельную колонку (страницу).
   *
   * @param {HTMLElement} pageContent - Контейнер для контента
   * @param {HTMLElement[]} articles - Массив статей (глав)
   * @private
   */
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
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "button");
      tocList.appendChild(li);
    });

    toc.appendChild(tocTitle);
    toc.appendChild(tocList);
    toc.style.breakAfter = "column";
    pageContent.appendChild(toc);
  }

  /**
   * Добавить чанк статей в контейнер
   *
   * Каждая статья предваряется маркером начала главы для последующего
   * расчёта позиций глав. Статьи клонируются для изоляции от оригинала.
   *
   * @param {HTMLElement} pageContent - Контейнер для контента
   * @param {HTMLElement[]} articles - Чанк статей для добавления
   * @param {number} startIndex - Индекс первой статьи в общем массиве
   * @private
   */
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

  /**
   * Выровнять главы по чётным страницам (левым в развороте)
   *
   * На desktop книга показывает разворот из двух страниц.
   * Главы должны начинаться с левой страницы (чётный индекс).
   * Если глава попадает на нечётную страницу - вставляется пустой спейсер.
   *
   * @param {HTMLElement} container - Контейнер пагинации
   * @param {HTMLElement} cols - Элемент с колонками
   * @param {number} pageWidth - Ширина одной страницы
   * @private
   */
  _alignChapters(container, cols, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];
    const colsRect = cols.getBoundingClientRect();

    markers.forEach((marker) => {
      const markerRect = marker.getBoundingClientRect();
      const colIndex = Math.round((markerRect.left - colsRect.left) / pageWidth);

      if (colIndex % 2 !== 0) {
        const spacer = document.createElement("div");
        spacer.style.height = "100%";
        spacer.style.breakBefore = "column";
        marker.before(spacer);
      }
    });
  }

  /**
   * Рассчитать индексы страниц начала глав
   *
   * Находит все маркеры глав и вычисляет их позиции
   * на основе горизонтального смещения.
   *
   * @param {HTMLElement} container - Контейнер пагинации
   * @param {number} pageWidth - Ширина одной страницы
   * @returns {number[]} Массив индексов страниц начала глав
   * @private
   */
  _calculateChapterStarts(container, pageWidth) {
    const markers = [...container.querySelectorAll("[data-chapter-start]")];
    return markers.map(m => Math.round(m.offsetLeft / pageWidth));
  }

  /**
   * Асинхронно нарезать контент на отдельные страницы
   *
   * Создаёт HTML-строку для каждой страницы путём клонирования
   * контейнера колонок и применения translateX для "окна просмотра".
   *
   * @param {HTMLElement} cols - Элемент с колонками
   * @param {HTMLElement} pageContent - Контейнер контента
   * @param {number} pageWidth - Ширина страницы
   * @param {number} pageHeight - Высота страницы
   * @param {AbortSignal} [signal] - Сигнал для отмены
   * @returns {Promise<HTMLElement[]>} Массив DOM-элементов страниц
   * @throws {DOMException} AbortError при отмене
   * @private
   */
  async _slicePagesAsync(cols, pageContent, pageWidth, pageHeight, signal) {
    const probe = document.createElement("div");
    probe.style.width = "1px";
    probe.style.height = pageHeight + "px";
    probe.style.breakBefore = "column";
    pageContent.appendChild(probe);

    const measuredCols = Math.max(1, Math.ceil(cols.scrollWidth / pageWidth));
    // Убираем probe-колонку из подсчёта — она нужна только для измерения,
    // но не содержит реального контента
    const totalCols = Math.max(1, measuredCols - 1);
    const result = [];

    // Один клон вместо N: переиспользуем snap/clone, меняя только translateX
    const snap = document.createElement("div");
    snap.style.cssText = `
      width: ${pageWidth}px;
      height: ${pageHeight}px;
      overflow: hidden;
    `;

    const clone = cols.cloneNode(true);
    clone.style.width = `${totalCols * pageWidth}px`;
    snap.appendChild(clone);

    for (let i = 0; i < totalCols; i++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      clone.style.transform = `translateX(${-i * pageWidth}px)`;
      result.push(snap.cloneNode(true));

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

  /**
   * Уничтожить пагинатор и освободить ресурсы
   *
   * Отменяет текущую операцию (если есть) и очищает подписки EventEmitter.
   */
  destroy() {
    this.abort();
    super.destroy();
  }
}
