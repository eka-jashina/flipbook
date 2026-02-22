/**
 * PHOTO LIGHTBOX
 *
 * Полноэкранный просмотр фотографий из фотоальбома.
 * Использует FLIP-анимацию: изображение «вылетает» из своей позиции
 * в центр экрана и «возвращается» обратно при закрытии.
 *
 * Навигация: стрелки ←/→, кнопки prev/next, свайп на мобильных.
 * Закрытие: крестик, клик по оверлею, Escape, Back (popstate).
 */

const TRANSITION_MS = 300;
const SWIPE_THRESHOLD = 40;

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
    /** @type {string} Поворот изображения (например 'rotate(90deg)') */
    this._rotation = '';

    /** @type {HTMLImageElement[]} Все фото в текущем контейнере */
    this._images = [];
    /** @type {number} Индекс текущего фото */
    this._currentIndex = -1;

    /** @type {{x: number, y: number}|null} Начало свайпа */
    this._touchStart = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPopState = this._onPopState.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

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

    // Прозрачный щит поверх картинки — блокирует прямой доступ к <img>
    this._imgShield = document.createElement('div');
    this._imgShield.className = 'lightbox__shield';

    this._closeBtn = document.createElement('button');
    this._closeBtn.className = 'lightbox__close';
    this._closeBtn.type = 'button';
    this._closeBtn.setAttribute('aria-label', 'Закрыть');
    this._closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

    // Кнопки навигации
    this._prevBtn = document.createElement('button');
    this._prevBtn.className = 'lightbox__nav lightbox__nav--prev';
    this._prevBtn.type = 'button';
    this._prevBtn.setAttribute('aria-label', 'Предыдущее фото');
    this._prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'lightbox__nav lightbox__nav--next';
    this._nextBtn.type = 'button';
    this._nextBtn.setAttribute('aria-label', 'Следующее фото');
    this._nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;

    // Счётчик фото
    this._counter = document.createElement('div');
    this._counter.className = 'lightbox__counter';

    // Подпись
    this._caption = document.createElement('div');
    this._caption.className = 'lightbox__caption';

    this._overlay.appendChild(this._img);
    this._overlay.appendChild(this._imgShield);
    this._overlay.appendChild(this._closeBtn);
    this._overlay.appendChild(this._prevBtn);
    this._overlay.appendChild(this._nextBtn);
    this._overlay.appendChild(this._counter);
    this._overlay.appendChild(this._caption);

    // Клик по оверлею или щиту — закрыть
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay || e.target === this._imgShield) this.close();
    });

    this._closeBtn.addEventListener('click', () => this.close());
    this._prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
    this._nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });

    // Защита от скачивания: блокировка контекстного меню и перетаскивания
    this._overlay.addEventListener('contextmenu', (e) => {
      if (e.target === this._img || e.target === this._imgShield) {
        e.preventDefault();
      }
    });
    this._img.addEventListener('dragstart', (e) => e.preventDefault());

    document.body.appendChild(this._overlay);
  }

  /**
   * Привязать делегированный обработчик клика к контейнеру
   * @param {HTMLElement} container — элемент, на котором слушать клики (обычно .book)
   */
  attach(container) {
    this._container = container;

    // Клик по ::before оверлею (на .photo-album__item) открывает лайтбокс
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.photo-album__item');
      if (!item) return;
      const img = item.querySelector('img');
      if (!img) return;

      e.stopPropagation();
      e.preventDefault();
      this.open(img);
    });

    // Защита от скачивания: блокировка контекстного меню на фото
    container.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.photo-album__item')) {
        e.preventDefault();
      }
    });

    // Защита от скачивания: блокировка перетаскивания изображений
    container.addEventListener('dragstart', (e) => {
      if (e.target.closest('.photo-album__item')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Собрать массив всех фото в контейнере
   */
  _collectImages() {
    if (!this._container) return [];
    return [...this._container.querySelectorAll('.photo-album__item img')].filter(img => img.src);
  }

  /**
   * Открыть лайтбокс с FLIP-анимацией
   * @param {HTMLImageElement} imgEl — кликнутая миниатюра
   */
  open(imgEl) {
    if (this._isOpen || this._isAnimating) return;
    this._isAnimating = true;

    // Собрать все фото для навигации
    this._images = this._collectImages();
    this._currentIndex = this._images.indexOf(imgEl);

    this._originImg = imgEl;
    this._originRect = imgEl.getBoundingClientRect();

    this._applyImage(imgEl);

    // FLIP: First — установить картинку в позицию миниатюры
    this._setTransformFromRect(this._originRect);
    this._overlay.classList.add('lightbox--visible');

    // Дать браузеру отрисовать первый кадр
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // FLIP: Play — убрать трансформацию, картинка поедет в центр
        this._overlay.classList.add('lightbox--active');
        this._img.style.transform = this._rotation || '';

        this._isOpen = true;
        this._isAnimating = false;
      });
    });

    // Слушатели
    document.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('popstate', this._onPopState);
    this._overlay.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this._overlay.addEventListener('touchend', this._onTouchEnd, { passive: true });

    // Добавить запись в history, чтобы Back закрывал лайтбокс
    history.pushState({ lightbox: true }, '');
  }

  /**
   * Применить данные изображения к лайтбоксу (src, filter, rotation, caption)
   * @param {HTMLImageElement} imgEl
   */
  _applyImage(imgEl) {
    this._img.src = imgEl.src;
    this._img.alt = imgEl.alt || '';

    // Перенести CSS-фильтр с миниатюры
    const computedFilter = getComputedStyle(imgEl).filter;
    this._img.style.filter = (computedFilter && computedFilter !== 'none') ? computedFilter : '';

    // Перенести поворот с миниатюры (inline style transform:rotate)
    const rotateMatch = imgEl.style.transform?.match(/rotate\(\d+deg\)/);
    this._rotation = rotateMatch ? rotateMatch[0] : '';

    // Подпись из figcaption
    const figcaption = imgEl.closest('.photo-album__item')?.querySelector('figcaption');
    if (figcaption?.textContent) {
      this._caption.textContent = figcaption.textContent;
      this._caption.hidden = false;
    } else {
      this._caption.textContent = '';
      this._caption.hidden = true;
    }

    this._updateNav();
  }

  /**
   * Обновить видимость кнопок навигации и счётчик
   */
  _updateNav() {
    const total = this._images.length;
    const hasPrev = this._currentIndex > 0;
    const hasNext = this._currentIndex < total - 1;

    this._prevBtn.hidden = !hasPrev;
    this._nextBtn.hidden = !hasNext;

    if (total > 1) {
      this._counter.textContent = `${this._currentIndex + 1} / ${total}`;
      this._counter.hidden = false;
    } else {
      this._counter.hidden = true;
    }
  }

  /**
   * Перейти к следующему фото
   */
  next() {
    if (this._isAnimating) return;
    if (this._currentIndex >= this._images.length - 1) return;
    this._navigateTo(this._currentIndex + 1);
  }

  /**
   * Перейти к предыдущему фото
   */
  prev() {
    if (this._isAnimating) return;
    if (this._currentIndex <= 0) return;
    this._navigateTo(this._currentIndex - 1);
  }

  /**
   * Перейти к фото по индексу с crossfade-анимацией
   * @param {number} index
   */
  _navigateTo(index) {
    if (index < 0 || index >= this._images.length) return;

    this._currentIndex = index;
    const imgEl = this._images[index];
    this._originImg = imgEl;

    // Плавная смена: fade-out / fade-in через CSS transition
    this._img.classList.add('lightbox__img--fade');
    setTimeout(() => {
      this._applyImage(imgEl);
      this._img.style.transform = this._rotation || '';
      this._img.classList.remove('lightbox__img--fade');
    }, 150);
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
    this._overlay.removeEventListener('touchstart', this._onTouchStart);
    this._overlay.removeEventListener('touchend', this._onTouchEnd);

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
      this._rotation = '';
      this._images = [];
      this._currentIndex = -1;
      this._touchStart = null;
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
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.prev();
    }
  }

  /** @private */
  _onPopState() {
    if (this._isOpen) {
      this.close();
    }
  }

  /** @private */
  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  /** @private */
  _onTouchEnd(e) {
    if (!this._touchStart) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStart.x;
    const dy = touch.clientY - this._touchStart.y;
    this._touchStart = null;

    // Горизонтальный свайп с достаточной дистанцией
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.next();
      else this.prev();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('popstate', this._onPopState);
    this._overlay?.removeEventListener('touchstart', this._onTouchStart);
    this._overlay?.removeEventListener('touchend', this._onTouchEnd);
    this._overlay?.remove();
    this._overlay = null;
  }
}

/** Синглтон */
export const photoLightbox = new PhotoLightbox();
