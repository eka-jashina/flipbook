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
 * Порядок инициализации (критичен!):
 * 1. Services  → CoreServices, затем остальные сервисы
 * 2. Components → StateMachine, Settings, DebugPanel
 * 3. Delegates  → Navigation, Lifecycle, Settings, Chapter, Drag
 * 4. Mediator   → Подписки на события делегатов
 * 5. Managers   → Subscriptions, ResizeHandler
 */

import { mediaQueries, ErrorHandler, getAnnouncer } from '../utils/index.js';
import { ComponentFactory } from './ComponentFactory.js';
import { AppInitializer } from './AppInitializer.js';
import { SubscriptionManager } from './SubscriptionManager.js';
import { ResizeHandler } from './ResizeHandler.js';
import { DelegateMediator } from './DelegateMediator.js';
import {
  NavigationDelegate,
  SettingsDelegate,
  LifecycleDelegate,
  ChapterDelegate,
  DragDelegate,
} from './delegates/index.js';

export class BookController {
  constructor() {
    this.isDestroyed = false;

    // Централизованное состояние (модифицируется только контроллером/медиатором)
    this.state = {
      index: 0,
      chapterStarts: []
    };

    // Screen reader announcer (singleton)
    this.announcer = getAnnouncer();

    // ВАЖНО: Порядок инициализации критичен!
    this._createServices();       // 1. Сервисные группы
    this._createComponents();     // 2. StateMachine, Settings, DebugPanel
    this._createDelegates();      // 3. Delegates с зависимостями
    this._createMediator();       // 4. Медиатор (подписки на события)
    this._setupManagers();        // 5. Subscriptions, handlers
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
   * Создать сервисные группы
   * @private
   */
  _createServices() {
    this.core = ComponentFactory.createCoreServices();
    this.factory = new ComponentFactory(this.core);
    this.settings = this.factory.createSettingsManager();
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

  /**
   * Создать делегаты с зависимостями
   * @private
   */
  _createDelegates() {
    const { dom, eventManager } = this.core;
    const { soundManager, ambientManager } = this.audio;
    const { renderer, animator, paginator, loadingIndicator } = this.render;
    const { contentLoader, backgroundManager } = this.content;

    this.chapterDelegate = new ChapterDelegate({
      backgroundManager,
      dom,
      state: this.state,
    });

    this.navigationDelegate = new NavigationDelegate({
      stateMachine: this.stateMachine,
      renderer,
      animator,
      settings: this.settings,
      soundManager,
      mediaQueries,
      state: this.state,
    });

    this.lifecycleDelegate = new LifecycleDelegate({
      stateMachine: this.stateMachine,
      backgroundManager,
      contentLoader,
      paginator,
      renderer,
      animator,
      loadingIndicator,
      soundManager,
      ambientManager,
      settings: this.settings,
      dom,
      mediaQueries,
      state: this.state,
    });

    this.settingsDelegate = new SettingsDelegate({
      dom,
      settings: this.settings,
      soundManager,
      ambientManager,
      debugPanel: this.debugPanel,
      stateMachine: this.stateMachine,
      mediaQueries,
      state: this.state,
    });

    this.dragDelegate = new DragDelegate({
      stateMachine: this.stateMachine,
      renderer,
      animator,
      soundManager,
      dom,
      eventManager,
      mediaQueries,
      state: this.state,
    });
  }

  /**
   * Создать медиатор для координации событий между делегатами
   * @private
   */
  _createMediator() {
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
   * Настроить менеджеры подписок и resize
   * @private
   */
  _setupManagers() {
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

      this.resizeHandler.bind();
      this.mediator.updateDebug();
    } catch (error) {
      ErrorHandler.handle(error, "Не удалось инициализировать приложение");
      throw error;
    }
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
    this.mediator = null;
    this.core = null;
    this.audio = null;
    this.render = null;
    this.content = null;
    this.factory = null;
  }
}
