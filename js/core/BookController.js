/**
 * BOOK CONTROLLER
 * Главный координатор приложения - предоставляет публичный API.
 * 
 * Основные обязанности:
 * - Координация между компонентами
 * - Публичный API для управления книгой
 * - Управление жизненным циклом
 * 
 * Делегирует специфичную логику:
 * - Инициализацию → AppInitializer
 * - Создание компонентов → ComponentFactory
 * - Управление DOM → DOMManager
 * - Навигацию → NavigationDelegate
 * - Настройки → SettingsDelegate
 * - Жизненный цикл → LifecycleDelegate
 * - Главы → ChapterDelegate
 * - Drag → DragDelegate
 */

import { cssVars, mediaQueries, EventListenerManager, TimerManager, StorageManager } from '../utils/index.js';
import { CONFIG, BookState } from '../config.js';
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
    // Флаг уничтожения
    this.isDestroyed = false;
    
    // Текущее состояние
    this.index = 0;
    this.chapterStarts = [];
    
    // Инициализация базовых менеджеров
    this._initializeCore();
    
    // Создание компонентов через фабрику
    this._createComponents();
    
    // Инициализация делегатов
    this._createDelegates();
    
    // Управление подписками и resize
    this._setupManagers();
  }

  // ═══════════════════════════════════════════
  // COMPUTED PROPERTIES
  // ═══════════════════════════════════════════
  
  /** @returns {boolean} Мобильный ли режим */
  get isMobile() {
    return mediaQueries.get("mobile");
  }
  
  /** @returns {number} Количество страниц на переворот */
  get pagesPerFlip() {
    return cssVars.getNumber("--pages-per-flip", this.isMobile ? 1 : 2);
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  /**
   * Инициализировать приложение
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isDestroyed) return;
    
    await this.initializer.initialize();
    this.subscriptions.subscribeToState(
      this.stateMachine, 
      this.dom, 
      () => this._updateDebug()
    );
    this.subscriptions.subscribeToPagination(this.paginator, this.loadingIndicator);
    this.subscriptions.subscribeToMediaQueries(
      keepIndex => this._repaginate(keepIndex),
      () => this.stateMachine.isOpened
    );
    this.resizeHandler.bind();
    this._updateDebug();
  }

  /**
   * Перелистнуть страницу
   * @param {'next'|'prev'} direction
   * @returns {Promise<void>}
   */
  flip(direction) {
    return this.navigationDelegate.flip(direction);
  }

  /**
   * Навигация по оглавлению
   * @param {number|undefined} chapter
   * @returns {Promise<void>}
   */
  handleTOCNavigation(chapter) {
    return this.navigationDelegate.handleTOCNavigation(chapter);
  }

  /**
   * Открыть книгу
   * @param {number} startIndex
   * @returns {Promise<void>}
   */
  openBook(startIndex = 0) {
    return this.lifecycleDelegate.open(startIndex);
  }

  /**
   * Закрыть книгу
   * @returns {Promise<void>}
   */
  closeBook() {
    return this.lifecycleDelegate.close();
  }

  /**
   * Обработать изменение настроек
   * @param {string} key
   * @param {*} value
   */
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
      this.animator, this.paginator, this.contentLoader,
      this.backgroundManager, this.eventController,
      this.stateMachine, this.settings, this.dragDelegate
    ];
    
    components.forEach(component => component?.destroy?.());

    // Очищаем менеджеры событий и таймеров
    this.eventManager.clear();
    this.timerManager.clear();

    // Очищаем страницы
    this.dom.clearPages();
    
    // Зануляем ссылки
    this.dom = null;
  }

  // ═══════════════════════════════════════════
  // ВНУТРЕННИЕ МЕТОДЫ
  // ═══════════════════════════════════════════

  /**
   * Инициализация базовых менеджеров
   * @private
   */
  _initializeCore() {
    this.dom = new DOMManager();
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.storage = new StorageManager(CONFIG.STORAGE_KEY);
  }

  /**
   * Создание компонентов через фабрику
   * @private
   */
  _createComponents() {
    const factory = new ComponentFactory({
      dom: this.dom,
      eventManager: this.eventManager,
      timerManager: this.timerManager,
      storage: this.storage,
    });

    this.stateMachine = factory.createStateMachine();
    this.settings = factory.createSettingsManager();
    this.backgroundManager = factory.createBackgroundManager();
    this.contentLoader = factory.createContentLoader();
    this.paginator = factory.createPaginator();
    this.renderer = factory.createRenderer();
    this.animator = factory.createAnimator();
    this.loadingIndicator = factory.createLoadingIndicator();
    this.debugPanel = factory.createDebugPanel();
    
    // EventController создается после делегатов
  }

  /**
   * Создание делегатов
   * @private
   */
  _createDelegates() {
    this.navigationDelegate = new NavigationDelegate(this);
    this.settingsDelegate = new SettingsDelegate(this);
    this.lifecycleDelegate = new LifecycleDelegate(this);
    this.chapterDelegate = new ChapterDelegate(this);
    this.dragDelegate = new DragDelegate(this);
    
    // Теперь создаем EventController с делегатами
    const factory = new ComponentFactory({
      dom: this.dom,
      eventManager: this.eventManager,
      timerManager: this.timerManager,
      storage: this.storage,
    });
    
    this.eventController = factory.createEventController({
      onFlip: dir => this.flip(dir),
      onTOCClick: ch => this.handleTOCNavigation(ch),
      onOpen: cont => this.openBook(cont ? this.settings.get("page") : 0),
      onSettings: (k, v) => this.handleSettingsChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragDelegate?.isActive,
      isOpened: () => this.stateMachine.isOpened,
    });
    
    // Создаем initializer после всех делегатов
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

  /**
   * Настройка менеджеров подписок и resize
   * @private
   */
  _setupManagers() {
    this.subscriptions = new SubscriptionManager();
    this.resizeHandler = new ResizeHandler({
      eventManager: this.eventManager,
      timerManager: this.timerManager,
      repaginateFn: keepIndex => this._repaginate(keepIndex),
      isOpenedFn: () => this.stateMachine.isOpened,
      isDestroyedFn: () => this.isDestroyed,
    });
  }

  /**
   * Репагинация контента
   * @param {boolean} keepIndex
   * @private
   */
  _repaginate(keepIndex) {
    return this.lifecycleDelegate.repaginate(keepIndex);
  }

  /**
   * Обновить панель отладки
   * @private
   */
  _updateDebug() {
    this.debugPanel.update({
      state: this.stateMachine.state,
      totalPages: this.renderer.pageContents.length,
      currentPage: this.index,
      cacheSize: this.renderer.cacheSize,
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit,
      listenerCount: this.eventManager.count,
    });
  }
}
