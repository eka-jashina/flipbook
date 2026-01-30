/**
 * LIFECYCLE DELEGATE
 * Управление жизненным циклом книги: открытие, закрытие, репагинация.
 *
 * Основные операции:
 * - open()       → Открыть книгу с анимацией и загрузкой контента
 * - close()      → Закрыть книгу с анимацией
 * - repaginate() → Пересчитать страницы (при смене шрифта/размера)
 */

import { CONFIG, BookState } from '../../config.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';
import { BaseDelegate } from './BaseDelegate.js';

export class LifecycleDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BookStateMachine} deps.stateMachine
   * @param {BackgroundManager} deps.backgroundManager
   * @param {ContentLoader} deps.contentLoader
   * @param {AsyncPaginator} deps.paginator
   * @param {BookRenderer} deps.renderer
   * @param {BookAnimator} deps.animator
   * @param {LoadingIndicator} deps.loadingIndicator
   * @param {SoundManager} deps.soundManager
   * @param {MediaQueryManager} deps.mediaQueries
   * @param {DOMManager} deps.dom
   * @param {Object} deps.state
   * @param {Function} deps.onPaginationComplete - Коллбэк с результатами пагинации
   * @param {Function} deps.onIndexChange - Коллбэк при изменении индекса
   * @param {Function} deps.onChapterUpdate - Коллбэк для обновления UI главы
   */
  constructor(deps) {
    super(deps);
    this.contentLoader = deps.contentLoader;
    this.paginator = deps.paginator;
    this.loadingIndicator = deps.loadingIndicator;
    this.onPaginationComplete = deps.onPaginationComplete;
    this.onIndexChange = deps.onIndexChange;
    this.onChapterUpdate = deps.onChapterUpdate;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      [
        'stateMachine',
        'backgroundManager',
        'contentLoader',
        'paginator',
        'renderer',
        'animator',
        'loadingIndicator',
        'dom',
        'mediaQueries',
        'state'
      ],
      'LifecycleDelegate'
    );
  }

  /**
   * Инициализация - предзагрузка обложки и звуков
   */
  async init() {
    await Promise.all([
      this.backgroundManager.preload(CONFIG.COVER_BG, true),
      this.soundManager ? this.soundManager.preload() : Promise.resolve(),
    ]);
  }

  /**
   * Открыть книгу
   * @param {number} startIndex - Индекс начальной страницы
   */
  async open(startIndex = 0) {
    // ─── Этап 1: Проверка состояния ───
    if (this.isBusy || !this.stateMachine.isClosed) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.OPENING)) {
      return;
    }

    // ─── Этап 2: Звук открытия ───
    if (this.soundManager) {
      this.soundManager.play('bookOpen');
    }

    try {
      this.loadingIndicator.show();

      // ─── Этап 3: Параллельная загрузка (анимация + контент) ───
      // Связываем операции: если одна упадёт — отменяем вторую,
      // чтобы избежать рассогласования состояния.
      const chapterUrls = CONFIG.CHAPTERS.map(c => c.file);

      const animationPromise = this.animator.runOpenAnimation()
        .catch((err) => { this.contentLoader.abort(); throw err; });

      const contentPromise = this.contentLoader.load(chapterUrls)
        .catch((err) => { this.animator.abort(); throw err; });

      const [signal, html] = await Promise.all([
        animationPromise,
        contentPromise,
      ]);

      if (!signal || !html) {
        return; // Анимация была отменена
      }

      // ─── Этап 4: Ожидание стабилизации layout ───
      await this._waitForLayout();

      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found');
      }

      // ─── Этап 5: Пагинация контента ───
      const { pages, chapterStarts } = await this.paginator.paginate(html, rightA);

      if (this.onPaginationComplete) {
        this.onPaginationComplete(pages, chapterStarts);
      }

      // ─── Этап 6: Рендеринг начального разворота ───
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const safeStartIndex = Math.max(0, Math.min(startIndex, maxIndex));

      this.renderer.renderSpread(safeStartIndex, this.isMobile);

      if (this.onIndexChange) {
        this.onIndexChange(safeStartIndex);
      }

      if (this.onChapterUpdate) {
        this.onChapterUpdate();
      }

      // ─── Этап 7: Завершение анимации и переход в OPENED ───
      await this.animator.finishOpenAnimation(signal);
      this.stateMachine.transitionTo(BookState.OPENED);

      // ─── Этап 8: Запуск ambient звука ───
      // (требует user gesture, поэтому здесь, а не при инициализации)
      this._startAmbientIfNeeded();

    } catch (error) {
      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при открытии книги");
      }
      this.stateMachine.reset(BookState.CLOSED);
    } finally {
      this.loadingIndicator.hide();
    }
  }

  /**
   * Закрыть книгу
   */
  async close() {
    // ─── Этап 1: Проверка состояния ───
    if (this.isBusy || !this.isOpened) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.CLOSING)) {
      return;
    }

    // ─── Этап 2: Звук закрытия ───
    if (this.soundManager) {
      this.soundManager.play('bookClose');
    }

    // ─── Этап 3: Скрытие страниц перед анимацией ───
    const leftA = this.dom.get('leftA');
    const rightA = this.dom.get('rightA');

    if (leftA) {
      leftA.classList.add("closing-hidden");
      leftA.innerHTML = "";
    }

    if (rightA) {
      rightA.classList.add("closing-hidden");
      rightA.innerHTML = "";
    }

    try {
      // ─── Этап 4: Анимация закрытия ───
      await this.animator.runCloseAnimation();

      // ─── Этап 5: Восстановление и очистка ───
      if (leftA) leftA.classList.remove("closing-hidden");
      if (rightA) rightA.classList.remove("closing-hidden");

      if (this.onIndexChange) {
        this.onIndexChange(0);
      }

      this.renderer.clearCache();

      // ─── Этап 6: Переход в CLOSED ───
      this.stateMachine.transitionTo(BookState.CLOSED);

    } catch (error) {
      if (error.name !== "AbortError") {
        ErrorHandler.handle(error, "Ошибка при закрытии книги");
      }
      this.stateMachine.reset(BookState.OPENED);
    }
  }

  /**
   * Репагинация при изменении шрифта/размера/ориентации
   * @param {boolean} keepIndex - Сохранить текущую позицию
   */
  async repaginate(keepIndex = false) {
    try {
      // ─── Этап 1: Подготовка ───
      this.loadingIndicator.show();
      this.renderer.clearCache();

      const prevIndex = keepIndex ? this.currentIndex : 0;

      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found during repagination');
      }

      // ─── Этап 2: Загрузка контента ───
      const chapterUrls = CONFIG.CHAPTERS.map(c => c.file);
      const html = await this.contentLoader.load(chapterUrls);

      if (!html) {
        throw new Error('LifecycleDelegate: Failed to load content during repagination');
      }

      // ─── Этап 3: Пагинация ───
      const { pages, chapterStarts } = await this.paginator.paginate(html, rightA);

      if (this.onPaginationComplete) {
        this.onPaginationComplete(pages, chapterStarts);
      }

      // ─── Этап 4: Рендеринг с сохранением позиции ───
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const newIndex = keepIndex ? Math.min(prevIndex, maxIndex) : 0;

      this.renderer.renderSpread(newIndex, this.isMobile);

      if (this.onIndexChange) {
        this.onIndexChange(newIndex);
      }

      if (this.onChapterUpdate) {
        this.onChapterUpdate();
      }

    } catch (error) {
      ErrorHandler.handle(error, "Ошибка при репагинации");
    } finally {
      this.loadingIndicator.hide();
    }
  }

  /**
   * Запустить ambient звук, если он выбран в настройках
   * @private
   */
  _startAmbientIfNeeded() {
    if (!this.ambientManager || !this.settings) return;

    const ambientType = this.settings.get("ambientType");
    if (ambientType && ambientType !== AmbientManager.TYPE_NONE) {
      // Запускаем с fade-in для плавного появления
      this.ambientManager.setType(ambientType, true);
    }
  }

  /**
   * Ожидание стабилизации layout
   * @private
   */
  async _waitForLayout() {
    const book = this.dom.get('book');
    const rightA = this.dom.get('rightA');
    
    if (!book || !rightA) return;

    const bookWidth = book.offsetWidth;
    const minPageWidth = bookWidth * CONFIG.LAYOUT.MIN_PAGE_WIDTH_RATIO;
    const settleDelay = CONFIG.LAYOUT.SETTLE_DELAY;

    return new Promise((resolve) => {
      let settled = false;

      const checkLayout = () => {
        const pageWidth = rightA.offsetWidth;

        if (pageWidth >= minPageWidth && !settled) {
          settled = true;
          setTimeout(resolve, settleDelay);
        } else if (!settled) {
          requestAnimationFrame(checkLayout);
        }
      };

      checkLayout();
    });
  }

  /**
   * Очистка
   */
  destroy() {
    this.contentLoader = null;
    this.paginator = null;
    this.loadingIndicator = null;
    this.onPaginationComplete = null;
    this.onIndexChange = null;
    this.onChapterUpdate = null;
    super.destroy();
  }
}
