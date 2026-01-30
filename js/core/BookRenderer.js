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
    /** @type {string[]} HTML-содержимое всех страниц */
    this.pageContents = [];
    /** @type {Set<string>} Уже загруженные URL изображений */
    this.loadedImageUrls = new Set();

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
   * Установить содержимое страниц (после пагинации)
   * @param {string[]} contents - Массив HTML-строк для каждой страницы
   */
  setPageContents(contents) {
    this.pageContents = contents;
    this.cache.clear();
    // Не очищаем loadedImageUrls - изображения остаются в кэше браузера
  }

  /**
   * Получить DOM-элемент страницы (с кэшированием)
   * @param {number} index - Индекс страницы
   * @returns {HTMLElement|null} Клон DOM-элемента или null
   */
  getPageDOM(index) {
    if (index < 0 || index >= this.pageContents.length) {
      return null;
    }

    const cached = this.cache.get(index);
    if (cached) {
      return cached.cloneNode(true);
    }

    // Парсим HTML и кэшируем
    const wrapper = document.createElement("div");
    wrapper.innerHTML = this.pageContents[index];
    const dom = wrapper.firstElementChild || wrapper;

    this.cache.set(index, dom.cloneNode(true));
    return dom;
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

    // Пометить страницу с оглавлением (Safari-совместимая замена :has(.toc))
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
        this.loadedImageUrls.add(src);
        img.dataset.loading = "false";
        return;
      }

      // Показываем placeholder
      img.dataset.loading = "true";

      // Убираем placeholder после загрузки
      img.addEventListener("load", () => {
        this.loadedImageUrls.add(src);
        img.dataset.loading = "false";
      }, { once: true });

      // При ошибке тоже убираем placeholder
      img.addEventListener("error", () => {
        img.dataset.loading = "false";
      }, { once: true });
    });
  }

  /**
   * Отрендерить текущий разворот (две страницы на desktop, одна на mobile)
   * @param {number} index - Индекс левой страницы
   * @param {boolean} isMobile - Мобильный режим
   */
  renderSpread(index, isMobile) {
    const { leftActive, rightActive } = this.elements;

    if (!this.pageContents.length) {
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
    leftActive.dataset.buffer = "true";
    rightActive.dataset.buffer = "true";
    leftActive.dataset.active = "false";
    rightActive.dataset.active = "false";

    // Текущие buffer становятся active
    leftBuffer.dataset.buffer = "false";
    rightBuffer.dataset.buffer = "false";
    leftBuffer.dataset.active = "true";
    rightBuffer.dataset.active = "true";

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
    const total = this.pageContents.length;
    // На desktop последняя страница = total - 2 (левая страница последнего разворота)
    return isMobile ? total - 1 : Math.max(0, total - 2);
  }
}