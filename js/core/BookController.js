/**
 * BOOK CONTROLLER
 * Главный координатор приложения с Dependency Injection.
 *
 * Архитектура:
 * - Сервисные группы для логического объединения зависимостей
 * - Централизованное состояние (state)
 * - Делегаты для разделения ответственности
 * - Подписки на события через SubscriptionManager
 *
 * Сервисные группы:
 * - core:    DOM, EventManager, TimerManager, Storage
 * - audio:   SoundManager, AmbientManager
 * - render:  Renderer, Animator, Paginator, LoadingIndicator
 * - content: ContentLoader, BackgroundManager
 *
 * Порядок инициализации (критичен!):
 * 1. Services  → CoreServices, затем остальные сервисы
 * 2. Components → StateMachine, Settings, DebugPanel
 * 3. Delegates  → Navigation, Lifecycle, Settings, Chapter, Drag
 * 4. Managers   → Subscriptions, ResizeHandler
 */

import { mediaQueries } from '../utils/index.js';
import { CONFIG } from '../config.js';
import { ComponentFactory } from './ComponentFactory.js';
import { AppInitializer } from './AppInitializer.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { ResizeHandler } from './ResizeHandler.js';
import {
  NavigationDelegate,
  SettingsDelegate,
  LifecycleDelegate,
  ChapterDelegate,
  DragDelegate
} from './delegates/index.js';

export class BookController {
  constructor() {
    this.isDestroyed = false;

    // Централизованное состояние (модифицируется только контроллером)
    this.state = {
      index: 0,
      chapterStarts: []
    };

    // ВАЖНО: Порядок инициализации критичен!
    this._createServices();       // 1. Сервисные группы
    this._createComponents();     // 2. StateMachine, Settings, DebugPanel
    this._createDelegates();      // 3. Delegates с зависимостями
    this._setupManagers();        // 4. Subscriptions, handlers
  }

  // ═══════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════

  get isMobile() {
    return mediaQueries.get("mobile");
  }

  // Удобные геттеры для совместимости с существующим кодом
  get index() { return this.state.index; }
  set index(value) { this.state.index = value; }

  get chapterStarts() { return this.state.chapterStarts; }
  set chapterStarts(value) { this.state.chapterStarts = value; }

  // ═══════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════

  /**
   * Создать сервисные группы
   * @private
   */
  _createServices() {
    // CoreServices создается статическим методом (не требует зависимостей)
    this.core = ComponentFactory.createCoreServices();

    // Фабрика использует CoreServices
    this.factory = new ComponentFactory(this.core);

    // Settings нужен для AudioServices, создаём первым
    this.settings = this.factory.createSettingsManager();

    // Остальные сервисные группы
    this.audio = this.factory.createAudioServices(this.settings);
    this.render = this.factory.createRenderServices();
    this.content = this.factory.createContentServices();

    // Настройка ambient loading callbacks
    this.audio.setupAmbientLoadingCallbacks(this.core.dom.get('ambientPills'));
  }

  /**
   * Создать отдельные компоненты (не входящие в сервисные группы)
   * @private
   */
  _createComponents() {
    this.stateMachine = this.factory.createStateMachine();
    this.debugPanel = this.factory.createDebugPanel();
  }

  _createDelegates() {
    // Извлекаем компоненты из сервисных групп для делегатов
    const { dom, eventManager } = this.core;
    const { soundManager, ambientManager } = this.audio;
    const { renderer, animator, paginator, loadingIndicator } = this.render;
    const { contentLoader, backgroundManager } = this.content;

    // ChapterDelegate
    this.chapterDelegate = new ChapterDelegate({
      backgroundManager,
      dom,
      state: this.state,
    });

    // NavigationDelegate
    this.navigationDelegate = new NavigationDelegate({
      stateMachine: this.stateMachine,
      renderer,
      animator,
      settings: this.settings,
      soundManager,
      mediaQueries,
      state: this.state,
      onIndexChange: (newIndex) => this._handleIndexChange(newIndex),
      onBookOpen: () => this._handleBookOpen(),
      onBookClose: () => this._handleBookClose(),
    });

    // LifecycleDelegate
    this.lifecycleDelegate = new LifecycleDelegate({
      stateMachine: this.stateMachine,
      backgroundManager,
      contentLoader,
      paginator,
      renderer,
      animator,
      loadingIndicator,
      soundManager,
      dom,
      mediaQueries,
      state: this.state,
      onPaginationComplete: (pages, chapterStarts) =>
        this._handlePaginationComplete(pages, chapterStarts),
      onIndexChange: (newIndex) => this._handleIndexChange(newIndex),
      onChapterUpdate: () => this._updateChapterBackground(),
    });

    // SettingsDelegate
    this.settingsDelegate = new SettingsDelegate({
      dom,
      settings: this.settings,
      soundManager,
      ambientManager,
      debugPanel: this.debugPanel,
      stateMachine: this.stateMachine,
      mediaQueries,
      state: this.state,
      onUpdate: () => this._updateDebug(),
      onRepaginate: (keepIndex) => this._repaginate(keepIndex),
    });

    // DragDelegate
    this.dragDelegate = new DragDelegate({
      stateMachine: this.stateMachine,
      renderer,
      animator,
      soundManager,
      dom,
      eventManager,
      mediaQueries,
      state: this.state,
      onIndexChange: (newIndex) => this._handleIndexChange(newIndex),
      onChapterUpdate: () => this._updateChapterBackground(),
    });

    // EventController (переиспользуем фабрику)
    this.eventController = this.factory.createEventController({
      onFlip: (dir) => this.navigationDelegate.flip(dir),
      onTOCClick: (ch) => this.navigationDelegate.handleTOCNavigation(ch),
      onOpen: (cont) => this._handleBookOpen(cont),
      onSettings: (k, v) => this.settingsDelegate.handleChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragDelegate?.isActive,
      isOpened: () => this.stateMachine.isOpened,
    });

    // AppInitializer
    this.initializer = new AppInitializer({
      dom,
      settings: this.settings,
      settingsDelegate: this.settingsDelegate,
      backgroundManager,
      eventController: this.eventController,
      dragDelegate: this.dragDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
    });
  }

  _setupManagers() {
    this.subscriptions = new SubscriptionManager();
    this.resizeHandler = new ResizeHandler({
      eventManager: this.core.eventManager,
      timerManager: this.core.timerManager,
      repaginateFn: (keepIndex) => this._repaginate(keepIndex),
      isOpenedFn: () => this.stateMachine.isOpened,
      isDestroyedFn: () => this.isDestroyed,
    });
  }

  // ═══════════════════════════════════════════
  // ОБРАБОТЧИКИ КОЛЛБЭКОВ ОТ ДЕЛЕГАТОВ
  // ═══════════════════════════════════════════

  /**
   * Обработать изменение индекса
   * @private
   * @param {number} newIndex
   */
  _handleIndexChange(newIndex) {
    this.state.index = newIndex;
    this.settings.set("page", newIndex);
    this._updateChapterBackground();
    this._updateDebug();
    this._updateNavigationUI();
  }

  /**
   * Обработать результаты пагинации
   * @private
   * @param {string[]} pages
   * @param {number[]} chapterStarts
   */
  _handlePaginationComplete(pages, chapterStarts) {
    this.render.renderer.setPageContents(pages);
    this.state.chapterStarts = chapterStarts;
    this._updateNavigationUI();
  }

  /**
   * Обработать открытие книги
   * @private
   * @param {boolean} continueReading
   */
  async _handleBookOpen(continueReading = false) {
    const startIndex = continueReading ? this.settings.get("page") : 0;
    await this.lifecycleDelegate.open(startIndex);
  }

  /**
   * Обработать закрытие книги
   * @private
   */
  async _handleBookClose() {
    await this.lifecycleDelegate.close();
  }

  /**
   * Репагинация контента
   * @private
   * @param {boolean} keepIndex
   */
  async _repaginate(keepIndex) {
    await this.lifecycleDelegate.repaginate(keepIndex);
  }

  /**
   * Обновить фон главы
   * @private
   */
  _updateChapterBackground() {
    this.chapterDelegate.updateBackground(this.state.index, this.isMobile);
  }

  /**
   * Обновить панель отладки
   * @private
   */
  _updateDebug() {
    const { renderer } = this.render;
    this.debugPanel.update({
      state: this.stateMachine.state,
      totalPages: renderer.pageContents.length,
      currentPage: this.state.index,
      cacheSize: renderer.cacheSize,
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit,
      listenerCount: this.core.eventManager.count,
    });
  }

  /**
   * Обновить навигационный UI (счётчик страниц и прогресс-бар)
   * @private
   */
  _updateNavigationUI() {
    const { dom } = this.core;
    const totalPages = this.render.renderer.pageContents.length;
    const currentPage = this.state.index + 1; // 1-based для отображения

    // Обновить счётчик страниц
    const currentPageEl = dom.get('currentPage');
    const totalPagesEl = dom.get('totalPages');

    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    // Обновить прогресс-бар
    const progressBar = dom.get('readingProgress');
    if (progressBar && totalPages > 0) {
      const progress = Math.round((currentPage / totalPages) * 100);
      progressBar.style.setProperty("--progress-width", `${progress}%`);
      progressBar.setAttribute("aria-valuenow", progress);
    }

    // Обновить aria-label счётчика страниц
    const pageCounter = currentPageEl?.closest('.page-counter');
    if (pageCounter) {
      pageCounter.setAttribute('aria-label', `Страница ${currentPage} из ${totalPages}`);
    }
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  async init() {
    if (this.isDestroyed) return;

    await this.initializer.initialize();

    this.subscriptions.subscribeToState(
      this.stateMachine,
      this.core.dom,
      () => this._updateDebug()
    );

    this.subscriptions.subscribeToPagination(
      this.render.paginator,
      this.render.loadingIndicator
    );

    this.subscriptions.subscribeToMediaQueries(
      (keepIndex) => this._repaginate(keepIndex),
      () => this.stateMachine.isOpened
    );

    this.resizeHandler.bind();
    this._updateDebug();
  }

  /**
   * Уничтожить контроллер и очистить ресурсы
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Отписываемся от всех событий
    this.subscriptions.unsubscribeAll();
    this.resizeHandler.destroy();

    // Уничтожаем делегаты
    const delegates = [
      this.navigationDelegate,
      this.settingsDelegate,
      this.lifecycleDelegate,
      this.chapterDelegate,
      this.dragDelegate,
      this.eventController,
    ];
    delegates.forEach((d) => d?.destroy?.());

    // Уничтожаем отдельные компоненты
    this.stateMachine?.destroy?.();
    this.settings?.destroy?.();

    // Уничтожаем сервисные группы
    this.audio?.destroy();
    this.render?.destroy();
    this.content?.destroy();
    this.core?.destroy();

    // Зануляем ссылки
    this.state = null;
    this.core = null;
    this.audio = null;
    this.render = null;
    this.content = null;
    this.factory = null;
  }
}
