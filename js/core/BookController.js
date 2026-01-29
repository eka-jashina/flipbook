/**
 * BOOK CONTROLLER
 * Главный координатор приложения с Dependency Injection.
 */

import { 
  cssVars, 
  mediaQueries, 
  EventListenerManager, 
  TimerManager, 
  StorageManager 
} from '../utils/index.js';
import { CONFIG } from '../config.js';
import { DOMManager } from './DOMManager.js';
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
    this._initializeCore();       // 1. DOM, events, storage
    this._createComponents();     // 2. State, renderers, etc
    this._createDelegates();      // 3. Delegates с зависимостями
    this._setupManagers();        // 4. Subscriptions, handlers
  }

  // ═══════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════
  
  get isMobile() {
    return mediaQueries.get("mobile");
  }
  
  get pagesPerFlip() {
    return cssVars.getNumber("--pages-per-flip", this.isMobile ? 1 : 2);
  }

  // Удобные геттеры для совместимости с существующим кодом
  get index() { return this.state.index; }
  set index(value) { this.state.index = value; }
  
  get chapterStarts() { return this.state.chapterStarts; }
  set chapterStarts(value) { this.state.chapterStarts = value; }

  // ═══════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════

  _initializeCore() {
    this.dom = new DOMManager();
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.storage = new StorageManager(CONFIG.STORAGE_KEY);
  }

  _createComponents() {
    // Фабрика создается ОДИН РАЗ
    this.factory = new ComponentFactory({
      dom: this.dom,
      eventManager: this.eventManager,
      timerManager: this.timerManager,
      storage: this.storage,
    });

    this.stateMachine = this.factory.createStateMachine();
    this.settings = this.factory.createSettingsManager();
    this.soundManager = this.factory.createSoundManager(this.settings);
    this.ambientManager = this.factory.createAmbientManager(this.settings);
    this._setupAmbientLoadingCallbacks();
    this.backgroundManager = this.factory.createBackgroundManager();
    this.contentLoader = this.factory.createContentLoader();
    this.paginator = this.factory.createPaginator();
    this.renderer = this.factory.createRenderer();
    this.animator = this.factory.createAnimator();
    this.loadingIndicator = this.factory.createLoadingIndicator();
    this.debugPanel = this.factory.createDebugPanel();
  }

  _createDelegates() {
    // ChapterDelegate
    this.chapterDelegate = new ChapterDelegate({
      backgroundManager: this.backgroundManager,
      dom: this.dom,
      state: this.state,
    });

    // NavigationDelegate
    this.navigationDelegate = new NavigationDelegate({
      stateMachine: this.stateMachine,
      renderer: this.renderer,
      animator: this.animator,
      settings: this.settings,
      soundManager: this.soundManager,
      mediaQueries: mediaQueries,
      state: this.state,
      onIndexChange: (newIndex) => this._handleIndexChange(newIndex),
      onBookOpen: () => this._handleBookOpen(),
      onBookClose: () => this._handleBookClose(),
    });

    // LifecycleDelegate
    this.lifecycleDelegate = new LifecycleDelegate({
      stateMachine: this.stateMachine,
      backgroundManager: this.backgroundManager,
      contentLoader: this.contentLoader,
      paginator: this.paginator,
      renderer: this.renderer,
      animator: this.animator,
      loadingIndicator: this.loadingIndicator,
      soundManager: this.soundManager,
      dom: this.dom,
      mediaQueries: mediaQueries,
      state: this.state,
      onPaginationComplete: (pages, chapterStarts) => 
        this._handlePaginationComplete(pages, chapterStarts),
      onIndexChange: (newIndex) => this._handleIndexChange(newIndex),
      onChapterUpdate: () => this._updateChapterBackground(),
    });

    // SettingsDelegate
    this.settingsDelegate = new SettingsDelegate({
      dom: this.dom,
      settings: this.settings,
      soundManager: this.soundManager,
      ambientManager: this.ambientManager,
      debugPanel: this.debugPanel,
      stateMachine: this.stateMachine,
      mediaQueries: mediaQueries,
      state: this.state,
      onUpdate: () => this._updateDebug(),
      onRepaginate: (keepIndex) => this._repaginate(keepIndex),
    });

    // DragDelegate
    this.dragDelegate = new DragDelegate({
      stateMachine: this.stateMachine,
      renderer: this.renderer,
      animator: this.animator,
      soundManager: this.soundManager,
      dom: this.dom,
      eventManager: this.eventManager,
      mediaQueries: mediaQueries,
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
      dom: this.dom,
      settings: this.settings,
      settingsDelegate: this.settingsDelegate,
      backgroundManager: this.backgroundManager,
      eventController: this.eventController,
      dragDelegate: this.dragDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
    });
  }

  _setupManagers() {
    this.subscriptions = new SubscriptionManager();
    this.resizeHandler = new ResizeHandler({
      eventManager: this.eventManager,
      timerManager: this.timerManager,
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
    this.renderer.setPageContents(pages);
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
    this.debugPanel.update({
      state: this.stateMachine.state,
      totalPages: this.renderer.pageContents.length,
      currentPage: this.state.index,
      cacheSize: this.renderer.cacheSize,
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit,
      listenerCount: this.eventManager.count,
    });
  }

  /**
   * Обновить навигационный UI (счётчик страниц и прогресс-бар)
   * @private
   */
  _updateNavigationUI() {
    const totalPages = this.renderer.pageContents.length;
    const currentPage = this.state.index + 1; // 1-based для отображения

    // Обновить счётчик страниц
    const currentPageEl = this.dom.get('currentPage');
    const totalPagesEl = this.dom.get('totalPages');

    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;

    // Обновить прогресс-бар
    const progressBar = this.dom.get('readingProgress');
    if (progressBar && totalPages > 0) {
      const progress = (currentPage / totalPages) * 100;
      progressBar.style.setProperty("--progress-width", `${progress}%`);
    }
  }

  /**
   * Настроить коллбэки загрузки для ambient pills
   * @private
   */
  _setupAmbientLoadingCallbacks() {
    const ambientPills = this.dom.get('ambientPills');
    if (!ambientPills) return;

    // Функция для установки состояния загрузки на pill
    const setPillLoading = (type, isLoading) => {
      const pill = ambientPills.querySelector(`[data-type="${type}"]`);
      if (pill) {
        pill.dataset.loading = isLoading;
      }
    };

    this.ambientManager.onLoadStart = (type) => setPillLoading(type, true);
    this.ambientManager.onLoadEnd = (type) => setPillLoading(type, false);
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  async init() {
    if (this.isDestroyed) return;
    
    await this.initializer.initialize();
    
    this.subscriptions.subscribeToState(
      this.stateMachine,
      this.dom,
      () => this._updateDebug()
    );
    
    this.subscriptions.subscribeToPagination(
      this.paginator,
      this.loadingIndicator
    );
    
    this.subscriptions.subscribeToMediaQueries(
      (keepIndex) => this._repaginate(keepIndex),
      () => this.stateMachine.isOpened
    );
    
    this.resizeHandler.bind();
    this._updateDebug();
  }

  /**
   * Публичные методы для обратной совместимости
   */
  flip(direction) {
    return this.navigationDelegate.flip(direction);
  }

  handleTOCNavigation(chapter) {
    return this.navigationDelegate.handleTOCNavigation(chapter);
  }

  openBook(startIndex = 0) {
    return this.lifecycleDelegate.open(startIndex);
  }

  closeBook() {
    return this.lifecycleDelegate.close();
  }

  handleSettingsChange(key, value) {
    return this.settingsDelegate.handleChange(key, value);
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

    // Уничтожаем компоненты
    const components = [
      this.animator,
      this.paginator,
      this.contentLoader,
      this.backgroundManager,
      this.eventController,
      this.stateMachine,
      this.settings,
      this.soundManager,
      this.ambientManager,
      this.navigationDelegate,
      this.settingsDelegate,
      this.lifecycleDelegate,
      this.chapterDelegate,
      this.dragDelegate,
    ];

    components.forEach((component) => component?.destroy?.());

    // Очищаем менеджеры
    this.eventManager.clear();
    this.timerManager.clear();

    // Очищаем DOM
    this.dom.clearPages();

    // Зануляем ссылки
    this.state = null;
    this.dom = null;
    this.factory = null;
  }
}
