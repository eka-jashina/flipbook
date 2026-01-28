/**
 * LIFECYCLE DELEGATE - REFACTORED
 * Управление жизненным циклом книги.
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
    if (this.isBusy || !this.stateMachine.isClosed) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.OPENING)) {
      return;
    }

    // Воспроизводим звук открытия
    if (this.soundManager) {
      this.soundManager.play('bookOpen');
    }

    try {
      this.loadingIndicator.show();

      // Параллельно запускаем анимацию и загрузку контента
      const chapterUrls = CONFIG.CHAPTERS.map(c => c.file);
      const [signal, html] = await Promise.all([
        this.animator.runOpenAnimation(),
        this.contentLoader.load(chapterUrls),
      ]);

      // Проверяем, что анимация не была отменена
      if (!signal || !html) {
        return;
      }

      // Ждём стабилизации layout
      await this._waitForLayout();

      // Получаем элемент для измерения
      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found');
      }

      // Выполняем пагинацию
      const { pages, chapterStarts } = await this.paginator.paginate(html, rightA);

      // Передаем результаты пагинации через коллбэк
      if (this.onPaginationComplete) {
        this.onPaginationComplete(pages, chapterStarts);
      }

      // Вычисляем начальный индекс (с учетом maxIndex)
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const safeStartIndex = Math.max(0, Math.min(startIndex, maxIndex));

      // Рендерим начальный разворот
      this.renderer.renderSpread(safeStartIndex, this.isMobile);

      // Обновляем индекс через коллбэк
      if (this.onIndexChange) {
        this.onIndexChange(safeStartIndex);
      }

      // Обновляем UI главы
      if (this.onChapterUpdate) {
        this.onChapterUpdate();
      }

      // Завершаем анимацию открытия
      await this.animator.finishOpenAnimation(signal);

      // Переходим в состояние OPENED
      this.stateMachine.transitionTo(BookState.OPENED);

      // Запускаем ambient звук (требует user gesture, поэтому здесь, а не при инициализации)
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
    if (this.isBusy || !this.isOpened) {
      return;
    }

    if (!this.stateMachine.transitionTo(BookState.CLOSING)) {
      return;
    }

    // Воспроизводим звук закрытия
    if (this.soundManager) {
      this.soundManager.play('bookClose');
    }

    // Скрываем страницы перед анимацией
    const leftA = this.dom.get('leftA');
    const rightA = this.dom.get('rightA');
    
    if (leftA) {
      leftA.style.visibility = "hidden";
      leftA.innerHTML = "";
    }
    
    if (rightA) {
      rightA.style.visibility = "hidden";
      rightA.innerHTML = "";
    }

    try {
      await this.animator.runCloseAnimation();

      // Восстанавливаем видимость
      if (leftA) leftA.style.visibility = "";
      if (rightA) rightA.style.visibility = "";

      // Сбрасываем индекс через коллбэк
      if (this.onIndexChange) {
        this.onIndexChange(0);
      }

      // Очищаем кэш рендерера
      this.renderer.clearCache();

      // Переходим в состояние CLOSED
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
      this.loadingIndicator.show();
      this.renderer.clearCache();

      const prevIndex = keepIndex ? this.currentIndex : 0;

      const rightA = this.dom.get('rightA');
      if (!rightA) {
        throw new Error('LifecycleDelegate: rightA element not found during repagination');
      }

      // Загружаем и пагинируем заново
      const chapterUrls = CONFIG.CHAPTERS.map(c => c.file);
      const html = await this.contentLoader.load(chapterUrls);
      
      if (!html) {
        throw new Error('LifecycleDelegate: Failed to load content during repagination');
      }

      const { pages, chapterStarts } = await this.paginator.paginate(html, rightA);

      // Передаем результаты через коллбэк
      if (this.onPaginationComplete) {
        this.onPaginationComplete(pages, chapterStarts);
      }

      // Вычисляем новый индекс
      const maxIndex = this.renderer.getMaxIndex(this.isMobile);
      const newIndex = keepIndex ? Math.min(prevIndex, maxIndex) : 0;

      // Рендерим разворот
      this.renderer.renderSpread(newIndex, this.isMobile);

      // Обновляем индекс
      if (this.onIndexChange) {
        this.onIndexChange(newIndex);
      }

      // Обновляем UI главы
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
    if (ambientType && ambientType !== "none") {
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
