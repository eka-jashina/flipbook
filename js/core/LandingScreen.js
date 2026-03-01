/**
 * LANDING SCREEN
 *
 * Экран-лендинг для неавторизованных пользователей.
 * Показывает hero-секцию, витрину публичных книг, шаги «как это работает», footer.
 *
 * Данные витрины загружаются из GET /api/public/discover.
 * CTA-кнопка открывает AuthModal.
 */

export class LandingScreen {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - DOM-контейнер (#landing-screen)
   * @param {Function} options.onAuth - Колбэк при нажатии CTA (показать AuthModal)
   */
  constructor({ container, onAuth }) {
    this.container = container;
    this._onAuth = onAuth;
    this._boundClick = this._handleClick.bind(this);
    this._observer = null;
  }

  /**
   * Показать лендинг и загрузить витрину
   */
  async show() {
    this.container.hidden = false;
    document.body.dataset.screen = 'landing';

    this.container.addEventListener('click', this._boundClick);
    this._setupScrollAnimations();

    // Загрузить витрину публичных книг (не блокируем показ)
    this._loadShowcase();
  }

  /**
   * Скрыть лендинг
   */
  hide() {
    this.container.hidden = true;
  }

  /**
   * Очистка
   */
  destroy() {
    this.container.removeEventListener('click', this._boundClick);
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  // ═══════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════

  _handleClick(e) {
    const cta = e.target.closest('#landing-cta');
    if (cta) {
      e.preventDefault();
      if (this._onAuth) this._onAuth();
      return;
    }

    // Клик по карточке книги в витрине
    const card = e.target.closest('[data-book-id]');
    if (card) {
      // Пока ничего — в будущем можно переходить к /book/:id
    }
  }

  /**
   * Загрузить публичные книги для витрины
   */
  async _loadShowcase() {
    const showcase = this.container.querySelector('#landing-showcase');
    const grid = this.container.querySelector('#landing-showcase-grid');
    if (!showcase || !grid) return;

    try {
      const resp = await fetch('/api/public/discover?limit=6');
      if (!resp.ok) return;

      const { data: books } = await resp.json();
      if (!books?.length) return;

      grid.innerHTML = '';
      for (const book of books) {
        grid.appendChild(this._createBookCard(book));
      }
      showcase.hidden = false;
    } catch {
      // Витрина опциональна — при ошибке просто не показываем
    }
  }

  /**
   * Создать карточку книги для витрины
   * @param {Object} book
   * @returns {HTMLElement}
   */
  _createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'landing-book-card';
    card.dataset.bookId = book.id;

    const bgStart = book.appearance?.light?.coverBgStart || '#3a2d1f';
    const bgEnd = book.appearance?.light?.coverBgEnd || '#2a2016';
    const textColor = book.appearance?.light?.coverText || '#f2e9d8';
    const coverBgImage = book.appearance?.light?.coverBgImage;

    const coverStyle = coverBgImage
      ? `background: linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${coverBgImage}') center/cover`
      : `background: linear-gradient(135deg, ${bgStart}, ${bgEnd})`;

    card.innerHTML = `
      <div class="landing-book-cover" style="${coverStyle}; color: ${textColor}">
        <span class="landing-book-title">${this._escapeHtml(book.title || 'Без названия')}</span>
        ${book.author ? `<span class="landing-book-author">${this._escapeHtml(book.author)}</span>` : ''}
      </div>
    `;

    return card;
  }

  /**
   * Анимация появления секций при скролле
   */
  _setupScrollAnimations() {
    const sections = this.container.querySelectorAll('.landing-steps, .landing-showcase, .landing-footer');
    if (!sections.length) return;

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible');
            this._observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    for (const section of sections) {
      this._observer.observe(section);
    }
  }

  /**
   * Экранирование HTML
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
