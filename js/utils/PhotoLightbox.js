/**
 * PHOTO LIGHTBOX
 *
 * Полноэкранный просмотр фотографий из фотоальбома.
 * Использует FLIP-анимацию: изображение «вылетает» из своей позиции
 * в центр экрана и «возвращается» обратно при закрытии.
 *
 * Закрытие: крестик, клик по оверлею, Escape, Back (popstate).
 */

const TRANSITION_MS = 300;

export class PhotoLightbox {
  constructor() {
    /** @type {HTMLElement|null} Оверлей */
    this._overlay = null;
    /** @type {HTMLImageElement|null} Полноэкранное изображение */
    this._img = null;
    /** @type {HTMLButtonElement|null} Кнопка закрытия */
    this._closeBtn = null;
    /** @type {DOMRect|null} Исходная позиция миниатюры */
    this._originRect = null;
    /** @type {HTMLImageElement|null} Исходная миниатюра */
    this._originImg = null;
    /** @type {boolean} */
    this._isOpen = false;
    /** @type {boolean} */
    this._isAnimating = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPopState = this._onPopState.bind(this);

    this._buildDOM();
  }

  /**
   * Создать DOM-структуру лайтбокса (один раз)
   */
  _buildDOM() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'lightbox';
    this._overlay.setAttribute('role', 'dialog');
    this._overlay.setAttribute('aria-modal', 'true');
    this._overlay.setAttribute('aria-label', 'Просмотр фотографии');

    this._img = document.createElement('img');
    this._img.className = 'lightbox__img';
    this._img.alt = '';

    this._closeBtn = document.createElement('button');
    this._closeBtn.className = 'lightbox__close';
    this._closeBtn.type = 'button';
    this._closeBtn.setAttribute('aria-label', 'Закрыть');
    this._closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

    // Подпись
    this._caption = document.createElement('div');
    this._caption.className = 'lightbox__caption';

    this._overlay.appendChild(this._img);
    this._overlay.appendChild(this._closeBtn);
    this._overlay.appendChild(this._caption);

    // Клик по оверлею (но не по картинке) — закрыть
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    this._closeBtn.addEventListener('click', () => this.close());

    document.body.appendChild(this._overlay);
  }

  /**
   * Привязать делегированный обработчик клика к контейнеру
   * @param {HTMLElement} container — элемент, на котором слушать клики (обычно .book)
   */
  attach(container) {
    container.addEventListener('click', (e) => {
      const img = e.target.closest('.photo-album__item img');
      if (!img) return;

      e.stopPropagation();
      e.preventDefault();
      this.open(img);
    });
  }

  /**
   * Открыть лайтбокс с FLIP-анимацией
   * @param {HTMLImageElement} imgEl — кликнутая миниатюра
   */
  open(imgEl) {
    if (this._isOpen || this._isAnimating) return;
    this._isAnimating = true;

    this._originImg = imgEl;
    this._originRect = imgEl.getBoundingClientRect();

    // Настроить полноэкранную картинку
    this._img.src = imgEl.src;
    this._img.alt = imgEl.alt || '';

    // Перенести CSS-фильтр с миниатюры (применяется через класс на figure)
    const computedFilter = getComputedStyle(imgEl).filter;
    this._img.style.filter = (computedFilter && computedFilter !== 'none') ? computedFilter : '';

    // Подпись из figcaption
    const figcaption = imgEl.closest('.photo-album__item')?.querySelector('figcaption');
    if (figcaption?.textContent) {
      this._caption.textContent = figcaption.textContent;
      this._caption.hidden = false;
    } else {
      this._caption.textContent = '';
      this._caption.hidden = true;
    }

    // FLIP: First — установить картинку в позицию миниатюры
    this._setTransformFromRect(this._originRect);
    this._overlay.classList.add('lightbox--visible');

    // Дать браузеру отрисовать первый кадр
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // FLIP: Play — убрать трансформацию, картинка поедет в центр
        this._overlay.classList.add('lightbox--active');
        this._img.style.transform = '';

        this._isOpen = true;
        this._isAnimating = false;
      });
    });

    // Слушатели
    document.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('popstate', this._onPopState);

    // Добавить запись в history, чтобы Back закрывал лайтбокс
    history.pushState({ lightbox: true }, '');
  }

  /**
   * Закрыть лайтбокс с обратной анимацией
   */
  close() {
    if (!this._isOpen || this._isAnimating) return;
    this._isAnimating = true;

    // Убрать слушатели
    document.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('popstate', this._onPopState);

    this._overlay.classList.remove('lightbox--active');

    // FLIP обратно: вернуть картинку в позицию миниатюры
    // Пересчитать rect (может измениться при скролле)
    if (this._originImg) {
      this._originRect = this._originImg.getBoundingClientRect();
    }
    if (this._originRect) {
      this._setTransformFromRect(this._originRect);
    }

    setTimeout(() => {
      this._overlay.classList.remove('lightbox--visible');
      this._img.style.transform = '';
      this._img.style.filter = '';
      this._img.src = '';
      this._isOpen = false;
      this._isAnimating = false;
      this._originImg = null;
      this._originRect = null;
    }, TRANSITION_MS);
  }

  /**
   * Установить CSS transform на картинку, чтобы она визуально
   * совпала с переданным rect (позиция миниатюры)
   * @param {DOMRect} rect
   */
  _setTransformFromRect(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Целевой размер: картинка займёт ~90% экрана с object-fit: contain
    const padding = 40;
    const targetW = vw - padding * 2;
    const targetH = vh - padding * 2;

    // Масштаб миниатюры относительно целевого размера
    const scaleX = rect.width / targetW;
    const scaleY = rect.height / targetH;
    const scale = Math.max(scaleX, scaleY);

    // Центр целевой позиции
    const targetCx = vw / 2;
    const targetCy = vh / 2;

    // Центр миниатюры
    const originCx = rect.left + rect.width / 2;
    const originCy = rect.top + rect.height / 2;

    const dx = originCx - targetCx;
    const dy = originCy - targetCy;

    this._img.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }

  /** @private */
  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Убрать history-запись
      history.back();
    }
  }

  /** @private */
  _onPopState() {
    if (this._isOpen) {
      this.close();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('popstate', this._onPopState);
    this._overlay?.remove();
    this._overlay = null;
  }
}

/** Синглтон */
export const photoLightbox = new PhotoLightbox();
