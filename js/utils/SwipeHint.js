/**
 * SWIPE HINT
 *
 * Подсказка о жесте свайпа для мобильных пользователей.
 * Показывается один раз при первом открытии книги на мобильном устройстве.
 */

const STORAGE_KEY = 'flipbook-swipe-hint-shown';
const AUTO_HIDE_DELAY = 3500;

export class SwipeHint {
  constructor() {
    this._el = document.getElementById('swipe-hint');
    this._timer = null;
  }

  /**
   * Показать подсказку, если ещё не показывалась и экран мобильный.
   * Вызывается после открытия книги.
   */
  showIfNeeded() {
    if (!this._el) return;

    // Не показывать на десктопе
    if (window.matchMedia('(min-width: 769px)').matches) return;

    // Не показывать повторно
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage недоступен — не показываем
      return;
    }

    this._show();
  }

  _show() {
    this._el.hidden = false;

    requestAnimationFrame(() => {
      this._el.classList.add('swipe-hint--visible');
    });

    // Скрыть по таймеру
    this._timer = setTimeout(() => this._hide(), AUTO_HIDE_DELAY);

    // Скрыть по касанию
    this._el.addEventListener('click', () => this._hide(), { once: true });
    this._el.addEventListener('touchstart', () => this._hide(), { once: true, passive: true });
  }

  _hide() {
    clearTimeout(this._timer);

    this._el.classList.remove('swipe-hint--visible');

    // Запомнить что уже показали
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Игнорируем ошибки localStorage
    }

    // Убрать из DOM после анимации
    setTimeout(() => {
      if (this._el) this._el.hidden = true;
    }, 400);
  }
}
