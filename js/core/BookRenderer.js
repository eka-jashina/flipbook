/**
 * BOOK RENDERER
 * Отвечает за рендеринг страниц в DOM.
 *
 * Особенности:
 * - Двойная буферизация (active/buffer) для плавных переходов
 * - LRU-кэш DOM-элементов страниц для производительности
 * - Раздельный рендеринг для desktop (разворот) и mobile (одна страница)
 * - Подготовка sheet (перелистываемый лист) для анимации
 */

import { LRUCache } from '../utils/LRUCache.js';
import { BoolStr } from '../config.js';

/** @constant {number} Максимальное количество URL изображений в кэше */
const IMAGE_URL_CACHE_LIMIT = 100;

export class BookRenderer {
  /**
   * @param {Object} options - Конфигурация рендерера
   * @param {number} options.cacheLimit - Максимальный размер LRU-кэша
   * @param {HTMLElement} options.leftActive - Левая активная страница
   * @param {HTMLElement} options.rightActive - Правая активная страница
   * @param {HTMLElement} options.leftBuffer - Левый буфер
   * @param {HTMLElement} options.rightBuffer - Правый буфер
   * @param {HTMLElement} options.sheetFront - Лицевая сторона перелистываемого листа
   * @param {HTMLElement} options.sheetBack - Оборотная сторона перелистываемого листа
   */

  constructor(options) {
    this.cache = new LRUCache(options.cacheLimit || 12);
    /** @type {Set<string>} Уже загруженные URL изображений (ограниченный размер) */
    this.loadedImageUrls = new Set();

    // Данные для ленивой материализации страниц (вместо массива pageContents)
    /** @type {HTMLElement|null} Исходный multi-column элемент */
    this._sourceElement = null;
    /** @type {number} Общее количество страниц */
    this._totalPages = 0;
    /** @type {number} Ширина одной страницы (px) */
    this._pageWidth = 0;
    /** @type {number} Высота одной страницы (px) */
    this._pageHeight = 0;

    this.elements = {
      leftActive: options.leftActive,
      rightActive: options.rightActive,
      leftBuffer: options.leftBuffer,
      rightBuffer: options.rightBuffer,
      sheetFront: options.sheetFront,
      sheetBack: options.sheetBack,
    };
  }

  /**
   * Общее количество страниц
   * @returns {number}
   */
  get totalPages() {
    return this._totalPages;
  }

  /**
   * Установить данные пагинации для ленивой материализации страниц
   *
   * Вместо хранения N DOM-клонов (один на страницу), хранит один
   * исходный элемент и создаёт страницы по требованию через LRU-кэш.
   *
   * @param {Object|null} pageData - Данные пагинации
   * @param {HTMLElement} pageData.sourceElement - Исходный multi-column элемент
   * @param {number} pageData.pageCount - Количество страниц
   * @param {number} pageData.pageWidth - Ширина страницы
   * @param {number} pageData.pageHeight - Высота страницы
   */
  setPaginationData(pageData) {
    this._sourceElement = pageData?.sourceElement || null;
    this._totalPages = pageData?.pageCount || 0;
    this._pageWidth = pageData?.pageWidth || 0;
    this._pageHeight = pageData?.pageHeight || 0;
    this.cache.clear();
    // Очищаем loadedImageUrls при смене контента для предотвращения утечки памяти
    // Браузер всё равно кэширует изображения, поэтому placeholder покажется кратко
    this.loadedImageUrls.clear();
  }

  /**
   * Получить DOM-элемент страницы (с кэшированием и ленивой материализацией)
   *
   * Страница создаётся из исходного multi-column элемента по требованию,
   * а не хранится заранее. LRU-кэш предотвращает повторную материализацию.
   *
   * @param {number} index - Индекс страницы
   * @returns {HTMLElement|null} Клон DOM-элемента или null
   */
  getPageDOM(index) {
    if (index < 0 || index >= this._totalPages) {
      return null;
    }

    const cached = this.cache.get(index);
    if (cached) {
      return cached.cloneNode(true);
    }

    // Ленивая материализация: создаём страницу из исходного элемента
    const page = this._materializePage(index);
    if (page) {
      this.cache.set(index, page);
      return page.cloneNode(true);
    }

    return null;
  }

  /**
   * Материализовать DOM-элемент страницы из исходного multi-column элемента
   *
   * Создаёт viewport div с overflow:hidden и вставляет клон
   * исходного контента с translateX для отображения нужной колонки.
   *
   * @param {number} index - Индекс страницы
   * @returns {HTMLElement|null} DOM-элемент страницы или null
   * @private
   */
  _materializePage(index) {
    if (!this._sourceElement) return null;

    const snap = document.createElement("div");
    snap.style.cssText = `
      width: ${this._pageWidth}px;
      height: ${this._pageHeight}px;
      overflow: hidden;
    `;

    const clone = this._sourceElement.cloneNode(true);
    clone.style.width = `${this._totalPages * this._pageWidth}px`;
    clone.style.transform = `translateX(${-index * this._pageWidth}px)`;
    snap.appendChild(clone);

    return snap;
  }

  /**
   * Заполнить контейнер содержимым страницы
   * @param {HTMLElement} container - Контейнер страницы
   * @param {number} pageIndex - Индекс страницы
   */
  fill(container, pageIndex) {
    if (!container) return;
    const dom = this.getPageDOM(pageIndex);

    if (dom) {
      container.replaceChildren(dom);
      this._setupImageBlurPlaceholders(container);
    } else {
      container.replaceChildren();
    }

    // Пометить страницу с оглавлением
    const page = container.closest(".page");
    if (page) {
      page.classList.toggle("page--toc", !!container.querySelector(".toc"));
    }
  }

  /**
   * Настроить placeholder для изображений в контейнере
   * @param {HTMLElement} container - Контейнер с контентом
   * @private
   */
  _setupImageBlurPlaceholders(container) {
    const images = container.querySelectorAll("img");

    images.forEach((img) => {
      const src = img.src;

      // Если это изображение уже загружалось ранее - показываем сразу
      if (this.loadedImageUrls.has(src)) {
        img.dataset.loading = "false";
        return;
      }

      // Если изображение уже загружено (из кэша браузера)
      if (img.complete && img.naturalWidth > 0) {
        this._trackLoadedImage(src);
        img.dataset.loading = "false";
        return;
      }

      // Показываем placeholder
      img.dataset.loading = "true";

      // Убираем placeholder после загрузки
      img.addEventListener("load", () => {
        this._trackLoadedImage(src);
        img.dataset.loading = "false";
      }, { once: true });

      // При ошибке тоже убираем placeholder
      img.addEventListener("error", () => {
        img.dataset.loading = "false";
      }, { once: true });
    });
  }

  /**
   * Добавить URL в список загруженных изображений с ограничением размера
   * @param {string} src - URL изображения
   * @private
   */
  _trackLoadedImage(src) {
    if (this.loadedImageUrls.has(src)) {
      return;
    }

    // FIFO-вытеснение: удаляем самый старый URL при превышении лимита
    if (this.loadedImageUrls.size >= IMAGE_URL_CACHE_LIMIT) {
      const oldestUrl = this.loadedImageUrls.values().next().value;
      this.loadedImageUrls.delete(oldestUrl);
    }

    this.loadedImageUrls.add(src);
  }

  /**
   * Отрендерить текущий разворот (две страницы на desktop, одна на mobile)
   * @param {number} index - Индекс левой страницы
   * @param {boolean} isMobile - Мобильный режим
   */
  renderSpread(index, isMobile) {
    const { leftActive, rightActive } = this.elements;

    if (!this._totalPages) {
      leftActive?.replaceChildren();
      rightActive?.replaceChildren();
      return;
    }

    if (isMobile) {
      // На мобильных: левая пустая, правая = текущая страница
      leftActive?.replaceChildren();
      this.fill(rightActive, index);
    } else {
      // На desktop: левая = чётная, правая = нечётная
      this.fill(leftActive, index);
      this.fill(rightActive, index + 1);
    }
  }

  /**
   * Подготовить буферные страницы для следующего разворота
   * @param {number} index - Индекс левой страницы следующего разворота
   * @param {boolean} isMobile - Мобильный режим
   */
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

  /**
   * Подготовить sheet (перелистываемый лист) для анимации
   * @param {number} currentIndex - Текущий индекс
   * @param {number} nextIndex - Следующий индекс
   * @param {'next'|'prev'} direction - Направление перелистывания
   * @param {boolean} isMobile - Мобильный режим
   */
  prepareSheet(currentIndex, nextIndex, direction, isMobile) {
    const { sheetFront, sheetBack } = this.elements;

    if (isMobile) {
      this.fill(sheetFront, currentIndex);
      this.fill(sheetBack, nextIndex);
    } else {
      // Desktop: sheet содержит правую страницу текущего разворота
      // и левую страницу следующего/предыдущего
      if (direction === "next") {
        this.fill(sheetFront, currentIndex + 1);
        this.fill(sheetBack, currentIndex + 2);
      } else {
        this.fill(sheetFront, currentIndex);
        this.fill(sheetBack, currentIndex - 1);
      }
    }
  }

  /**
   * Поменять местами active и buffer страницы
   * Вызывается в середине анимации перелистывания
   */
  swapBuffers() {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.elements;

    // Текущие active становятся buffer
    leftActive.dataset.buffer = BoolStr.TRUE;
    rightActive.dataset.buffer = BoolStr.TRUE;
    leftActive.dataset.active = BoolStr.FALSE;
    rightActive.dataset.active = BoolStr.FALSE;

    // Текущие buffer становятся active
    leftBuffer.dataset.buffer = BoolStr.FALSE;
    rightBuffer.dataset.buffer = BoolStr.FALSE;
    leftBuffer.dataset.active = BoolStr.TRUE;
    rightBuffer.dataset.active = BoolStr.TRUE;

    // Обновляем ссылки
    this.elements.leftActive = leftBuffer;
    this.elements.leftBuffer = leftActive;
    this.elements.rightActive = rightBuffer;
    this.elements.rightBuffer = rightActive;
  }

  /**
   * Очистить кэш DOM-элементов
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Текущий размер кэша
   * @returns {number}
   */
  get cacheSize() {
    return this.cache.size;
  }

  /**
   * Получить максимальный допустимый индекс страницы
   * @param {boolean} isMobile - Мобильный режим
   * @returns {number}
   */
  getMaxIndex(isMobile) {
    const total = this._totalPages;
    // На desktop последняя страница = total - 2 (левая страница последнего разворота)
    return isMobile ? total - 1 : Math.max(0, total - 2);
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.cache.clear();
    this.loadedImageUrls.clear();
    this._sourceElement = null;
    this._totalPages = 0;
    this._pageWidth = 0;
    this._pageHeight = 0;
    this.elements = null;
  }
}