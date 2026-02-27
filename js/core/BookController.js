/**
 * BOOK CONTROLLER
 * DI-контейнер и жизненный цикл приложения.
 *
 * Ответственность:
 * - Создание и связывание сервисов, компонентов, делегатов
 * - Управление жизненным циклом (init / destroy)
 *
 * Координация событий между делегатами вынесена в DelegateMediator.
 *
 * Граф зависимостей инициализации:
 *
 *   _createServices()     — корневая фаза, без зависимостей
 *        ↓
 *   _createComponents()   — зависит от factory
 *        ↓
 *   _createDelegates()    — зависит от services + components
 *        ↓
 *   _createMediator()     — зависит от delegates + services + components
 *        ↓
 *   _setupManagers()      — зависит от core + mediator + stateMachine
 *
 * Каждая фаза валидирует свои зависимости через _assertDependencies().
 */

import { mediaQueries, ErrorHandler, getAnnouncer } from '../utils/index.js';
import { ComponentFactory } from './ComponentFactory.js';
import { AppInitializer } from './AppInitializer.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { ResizeHandler } from './ResizeHandler.js';
import { DelegateMediator } from './DelegateMediator.js';
import { createBookDelegates } from './BookDIConfig.js';

export class BookController {
  /**
   * @param {Object} [_config] - CONFIG (устанавливается через loadConfigFromAPI, здесь не используется)
   * @param {Object} [options]
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient] - API клиент
   * @param {string} [options.bookId] - ID книги
   * @param {Object} [options.serverProgress] - Прогресс чтения с сервера
   */
  constructor(_config, options = {}) {
    this.isDestroyed = false;
    this._apiClient = options.apiClient || null;
    this._bookId = options.bookId || null;
    this._serverProgress = options.serverProgress || null;

    // Централизованное состояние (модифицируется только контроллером/медиатором)
    this.state = {
      index: 0,
      chapterStarts: []
    };

    // Screen reader announcer (singleton)
    this.announcer = getAnnouncer();

    this._createServices();
    this._createComponents();
    this._createDelegates();
    this._createMediator();
    this._setupManagers();
  }

  // ═══════════════════════════════════════════
  // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
  // ═══════════════════════════════════════════

  get isMobile() {
    return mediaQueries.isMobile;
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
   * Проверить наличие обязательных зависимостей для фазы инициализации.
   * @private
   * @param {Object<string, *>} deps - Объект { имя: значение } зависимостей
   * @param {string} phase - Имя фазы для сообщения об ошибке
   * @throws {Error} Если хотя бы одна зависимость null/undefined
   */
  _assertDependencies(deps, phase) {
    const missing = Object.entries(deps)
      .filter(([, value]) => value === null || value === undefined)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `BookController.${phase}: отсутствуют зависимости: ${missing.join(', ')}. ` +
        `Проверьте порядок инициализации.`
      );
    }
  }

  /**
   * Создать сервисные группы (корневая фаза, без зависимостей)
   * @private
   */
  _createServices() {
    this.core = ComponentFactory.createCoreServices();
    this.factory = new ComponentFactory(this.core);
    this.settings = this.factory.createSettingsManager({
      apiClient: this._apiClient,
      bookId: this._bookId,
    });

    // Применить серверный прогресс и подключить sync-индикатор
    if (this._serverProgress) {
      this.settings.applyServerProgress(this._serverProgress);
    }
    if (this._apiClient && this._bookId) {
      this._setupSyncIndicator();
    }

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
    this._assertDependencies({ factory: this.factory }, '_createComponents');

    this.stateMachine = this.factory.createStateMachine();
    this.debugPanel = this.factory.createDebugPanel();
  }

  /**
   * Создать делегаты с зависимостями.
   * DI-конфигурация (какие зависимости получает каждый делегат) вынесена
   * в BookDIConfig.js для разделения ответственности.
   * @private
   */
  _createDelegates() {
    this._assertDependencies({
      core: this.core,
      audio: this.audio,
      render: this.render,
      content: this.content,
      stateMachine: this.stateMachine,
      settings: this.settings,
      debugPanel: this.debugPanel,
    }, '_createDelegates');

    const delegates = createBookDelegates({
      core: this.core,
      audio: this.audio,
      render: this.render,
      content: this.content,
      stateMachine: this.stateMachine,
      settings: this.settings,
      debugPanel: this.debugPanel,
      state: this.state,
    });

    this.chapterDelegate = delegates.chapter;
    this.navigationDelegate = delegates.navigation;
    this.lifecycleDelegate = delegates.lifecycle;
    this.settingsDelegate = delegates.settings;
    this.dragDelegate = delegates.drag;
  }

  /**
   * Создать медиатор для координации событий между делегатами
   * @private
   */
  _createMediator() {
    this._assertDependencies({
      navigationDelegate: this.navigationDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
      settingsDelegate: this.settingsDelegate,
      chapterDelegate: this.chapterDelegate,
      dragDelegate: this.dragDelegate,
      stateMachine: this.stateMachine,
      settings: this.settings,
      render: this.render,
      core: this.core,
      debugPanel: this.debugPanel,
      factory: this.factory,
    }, '_createMediator');

    this.mediator = new DelegateMediator({
      state: this.state,
      delegates: {
        navigation: this.navigationDelegate,
        lifecycle: this.lifecycleDelegate,
        settings: this.settingsDelegate,
        chapter: this.chapterDelegate,
        drag: this.dragDelegate,
      },
      services: {
        settings: this.settings,
        renderer: this.render.renderer,
        dom: this.core.dom,
        eventManager: this.core.eventManager,
        stateMachine: this.stateMachine,
        debugPanel: this.debugPanel,
        announcer: this.announcer,
      },
      isMobileFn: () => this.isMobile,
    });

    // EventController (переиспользуем фабрику)
    this.eventController = this.factory.createEventController({
      onFlip: (dir) => this.navigationDelegate.flip(dir),
      onTOCClick: (ch) => this.navigationDelegate.handleTOCNavigation(ch),
      onOpen: (cont) => this.mediator.handleBookOpen(cont),
      onSettings: (k, v) => this.settingsDelegate.handleChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragDelegate?.isActive,
      isOpened: () => this.stateMachine.isOpened,
      getFontSize: () => this.settings.get("fontSize"),
    });

    // Инициализатор приложения
    this.initializer = new AppInitializer({
      dom: this.core.dom,
      settings: this.settings,
      settingsDelegate: this.settingsDelegate,
      backgroundManager: this.content.backgroundManager,
      eventController: this.eventController,
      dragDelegate: this.dragDelegate,
      lifecycleDelegate: this.lifecycleDelegate,
    });
  }

  /**
   * Подключить индикатор синхронизации к SettingsManager
   * @private
   */
  _setupSyncIndicator() {
    const el = document.getElementById('sync-indicator');
    const textEl = document.getElementById('sync-indicator-text');
    if (!el || !textEl) return;

    this.settings.onSyncStateChange = (state) => {
      el.hidden = false;
      el.className = 'sync-indicator';

      switch (state) {
        case 'syncing':
          el.classList.add('sync-indicator--syncing');
          textEl.textContent = 'Сохранение...';
          break;
        case 'synced':
          el.classList.add('sync-indicator--synced');
          textEl.textContent = 'Сохранено';
          // Скрыть через 2 секунды
          setTimeout(() => { el.hidden = true; }, 2000);
          break;
        case 'error':
          el.classList.add('sync-indicator--error');
          textEl.textContent = 'Не сохранено';
          break;
      }
    };
  }

  /**
   * Настроить менеджеры подписок и resize
   * @private
   */
  _setupManagers() {
    this._assertDependencies({
      core: this.core,
      mediator: this.mediator,
      stateMachine: this.stateMachine,
    }, '_setupManagers');

    this.subscriptions = new SubscriptionManager();
    this.resizeHandler = new ResizeHandler({
      eventManager: this.core.eventManager,
      timerManager: this.core.timerManager,
      repaginateFn: (keepIndex) => this.mediator.repaginate(keepIndex),
      isOpenedFn: () => this.stateMachine.isOpened,
      isDestroyedFn: () => this.isDestroyed,
    });
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  /**
   * Проверить, что контроллер не уничтожен (use-after-free guard).
   * @private
   * @throws {Error}
   */
  _assertAlive() {
    if (this.isDestroyed) {
      throw new Error('BookController: вызов после уничтожения (use-after-free)');
    }
  }

  async init() {
    if (this.isDestroyed) return;

    try {
      await this.initializer.initialize();

      this.subscriptions.subscribeToState(
        this.stateMachine,
        this.core.dom,
        () => this.mediator.updateDebug()
      );

      this.subscriptions.subscribeToPagination(
        this.render.paginator,
        this.render.loadingIndicator
      );

      this.subscriptions.subscribeToMediaQueries(
        (keepIndex) => this.mediator.repaginate(keepIndex),
        () => this.stateMachine.isOpened
      );

      this.subscriptions.subscribeToSwipeHint(this.stateMachine);

      this.resizeHandler.bind();
      this.mediator.updateDebug();
    } catch (error) {
      ErrorHandler.handle(error, "Не удалось инициализировать приложение");
      throw error;
    }
  }

  /**
   * Уничтожить контроллер и очистить ресурсы.
   * Каждый компонент уничтожается в отдельном try-catch, чтобы
   * ошибка в одном не блокировала очистку остальных.
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    const errors = [];

    /** @param {Function} fn */
    const safeDestroy = (fn) => {
      try { fn(); } catch (err) { errors.push(err); }
    };

    // Отписываемся от всех событий
    safeDestroy(() => this.subscriptions?.unsubscribeAll());
    safeDestroy(() => this.resizeHandler?.destroy());

    // Уничтожаем делегаты
    const delegates = [
      this.navigationDelegate,
      this.settingsDelegate,
      this.lifecycleDelegate,
      this.chapterDelegate,
      this.dragDelegate,
      this.eventController,
    ];
    delegates.forEach((d) => safeDestroy(() => d?.destroy?.()));

    // Уничтожаем отдельные компоненты
    safeDestroy(() => this.stateMachine?.destroy?.());
    safeDestroy(() => this.settings?.destroy?.());

    // Уничтожаем сервисные группы
    safeDestroy(() => this.audio?.destroy());
    safeDestroy(() => this.render?.destroy());
    safeDestroy(() => this.content?.destroy());
    safeDestroy(() => this.core?.destroy());

    if (errors.length > 0) {
      console.error(`BookController.destroy: ${errors.length} ошибок при очистке:`, errors);
    }

    // Зануляем ссылки
    this.state = null;
    this.mediator = null;
    this.core = null;
    this.audio = null;
    this.render = null;
    this.content = null;
    this.factory = null;
    this.settings = null;
    this.stateMachine = null;
    this.eventController = null;
    this.navigationDelegate = null;
    this.settingsDelegate = null;
    this.lifecycleDelegate = null;
    this.chapterDelegate = null;
    this.dragDelegate = null;
  }
}
