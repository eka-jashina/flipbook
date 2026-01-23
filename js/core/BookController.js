/**
 * BOOK CONTROLLER
 * Фасад — координирует делегаты, сохраняет публичный API.
 */

import { CONFIG, BookState } from '../config.js';
import { cssVars, mediaQueries, EventListenerManager, TimerManager, StorageManager, ErrorHandler, sanitizer } from '../utils/index.js';
import { BookStateMachine, SettingsManager, BackgroundManager, ContentLoader, AsyncPaginator } from '../managers/index.js';
import { BookRenderer } from './BookRenderer.js';
import { BookAnimator } from './BookAnimator.js';
import { LoadingIndicator } from './LoadingIndicator.js';
import { EventController } from './EventController.js';
import { DebugPanel } from './DebugPanel.js';

// Делегаты
import { NavigationDelegate } from './delegates/NavigationDelegate.js';
import { SettingsDelegate } from './delegates/SettingsDelegate.js';
import { LifecycleDelegate } from './delegates/LifecycleDelegate.js';
import { ChapterDelegate } from './delegates/ChapterDelegate.js';
import { DragDelegate } from './delegates/DragDelegate.js';

export class BookController {
  constructor() {
    this._initManagers();
    this._cacheElements();
    this._initComponents();
    this._initDelegates();
    this._initState();
  }

  // === COMPUTED PROPERTIES ===
  
  get isMobile() { return mediaQueries.get("mobile"); }
  get pagesPerFlip() { return cssVars.getNumber("--pages-per-flip", this.isMobile ? 1 : 2); }

  // === ПУБЛИЧНЫЙ API ===

  /**
   * Инициализация приложения
   */
  async init() {
    if (this.isDestroyed) return;
    try {
      this._setupSubscriptions();
      this.settingsDelegate.apply();
      this._initUI();
      this._bindResize();
      await document.fonts.ready;

      await this.lifecycleDelegate.init();
      this._updateDebug();
    } catch (error) {
      ErrorHandler.handle(error, "Ошибка инициализации");
    }
  }

  /** Перелистнуть страницу */
  flip(direction) { return this.navigationDelegate.flip(direction); }
  
  /** Навигация по оглавлению */
  handleTOCNavigation(chapter) { return this.navigationDelegate.handleTOCNavigation(chapter); }
  
  /** Открыть книгу */
  openBook(startIndex = 0) { return this.lifecycleDelegate.open(startIndex); }
  
  /** Закрыть книгу */
  closeBook() { return this.lifecycleDelegate.close(); }
  
  /** Обработать изменение настроек */
  handleSettingsChange(key, value) { return this.settingsDelegate.handleChange(key, value); }

  /**
   * Очистка ресурсов при уничтожении
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this._subscriptions.forEach(unsub => typeof unsub === "function" && unsub());
    this._subscriptions = [];

    [this.animator, this.paginator, this.contentLoader, this.backgroundManager,
     this.eventController, this.stateMachine, this.settings, this.dragDelegate].forEach(c => c?.destroy?.());

    this.eventManager.clear();
    this.timerManager.clear();

    ['leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack']
      .forEach(id => this.elements[id] && (this.elements[id].innerHTML = ""));

    this.elements = null;
  }

  // === ВНУТРЕННИЕ МЕТОДЫ ===

  /**
   * Инициализация менеджеров
   */
  _initManagers() {
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.stateMachine = new BookStateMachine();
    this.storage = new StorageManager(CONFIG.STORAGE_KEY);
    this.settings = new SettingsManager(this.storage, CONFIG.DEFAULT_SETTINGS);
  }

  /**
   * Кэширование DOM-элементов
   */
  _cacheElements() {
    const $ = id => document.getElementById(id);
    this.elements = {
      html: document.documentElement,
      body: document.body,
      book: $("book"), bookWrap: $("book-wrap"), cover: $("cover"),
      leftA: $("leftA"), rightA: $("rightA"), leftB: $("leftB"), rightB: $("rightB"),
      sheet: $("sheet"), sheetFront: $("sheetFront"), sheetBack: $("sheetBack"),
      flipShadow: $("flipShadow"),
      loadingOverlay: $("loadingOverlay"), loadingProgress: $("loadingProgress"),
      nextBtn: $("next"), prevBtn: $("prev"), tocBtn: $("tocBtn"), continueBtn: $("continueBtn"),
      increaseBtn: $("increase"), decreaseBtn: $("decrease"),
      fontSelect: $("font-select"), themeSelect: $("theme-select"), debugToggle: $("debugToggle"),
      debugInfo: $("debugInfo"), debugState: $("debugState"), debugTotal: $("debugTotal"),
      debugCurrent: $("debugCurrent"), debugCache: $("debugCache"),
      debugMemory: $("debugMemory"), debugListeners: $("debugListeners"),
    };
  }

  /**
   * Инициализация компонентов (renderer, animator, etc.)
   */
  _initComponents() {
    this.backgroundManager = new BackgroundManager();
    this.contentLoader = new ContentLoader();
    this.paginator = new AsyncPaginator({ sanitizer });
    
    this.renderer = new BookRenderer({
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit,
      leftActive: this.elements.leftA, rightActive: this.elements.rightA,
      leftBuffer: this.elements.leftB, rightBuffer: this.elements.rightB,
      sheetFront: this.elements.sheetFront, sheetBack: this.elements.sheetBack,
    });
    
    this.animator = new BookAnimator({
      book: this.elements.book, bookWrap: this.elements.bookWrap,
      cover: this.elements.cover, sheet: this.elements.sheet,
      timerManager: this.timerManager,
    });
    
    this.loadingIndicator = new LoadingIndicator(
      this.elements.loadingOverlay, 
      this.elements.loadingProgress
    );
    
    this.debugPanel = new DebugPanel({ 
      container: this.elements.debugInfo, 
      state: this.elements.debugState,
      total: this.elements.debugTotal, 
      current: this.elements.debugCurrent,
      cache: this.elements.debugCache, 
      memory: this.elements.debugMemory, 
      listeners: this.elements.debugListeners 
    });
    
    this.eventController = new EventController({
      book: this.elements.book, 
      eventManager: this.eventManager,
      onFlip: dir => this.flip(dir),
      onTOCClick: ch => this.handleTOCNavigation(ch),
      onOpen: cont => this.openBook(cont ? this.settings.get("page") : 0),
      onSettings: (k, v) => this.handleSettingsChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragDelegate?.isActive,
      isOpened: () => this.stateMachine.isOpened,
    });
  }

  /**
   * Инициализация делегатов
   */
  _initDelegates() {
    this.navigationDelegate = new NavigationDelegate(this);
    this.settingsDelegate = new SettingsDelegate(this);
    this.lifecycleDelegate = new LifecycleDelegate(this);
    this.chapterDelegate = new ChapterDelegate(this);
    this.dragDelegate = new DragDelegate(this);
  }

  /**
   * Инициализация начального состояния
   */
  _initState() {
    this.index = 0;
    this.chapterStarts = [];
    this.isDestroyed = false;
    this._subscriptions = [];
  }

  /**
   * Инициализация UI (фон, кнопки, события)
   */
  _initUI() {
    this.backgroundManager.setBackground(CONFIG.COVER_BG);
    this.elements.body.dataset.chapter = "cover";
    if (this.settings.get("page") > 0) this.elements.continueBtn.hidden = false;
    this.elements.fontSelect.value = this.settings.get("font");
    this.elements.themeSelect.value = this.settings.get("theme");
    
    this.eventController.bind({
      nextBtn: this.elements.nextBtn, prevBtn: this.elements.prevBtn,
      tocBtn: this.elements.tocBtn, continueBtn: this.elements.continueBtn,
      coverEl: this.elements.cover, increaseBtn: this.elements.increaseBtn,
      decreaseBtn: this.elements.decreaseBtn, fontSelect: this.elements.fontSelect,
      themeSelect: this.elements.themeSelect, debugToggle: this.elements.debugToggle,
    });
    
    this.dragDelegate.bind();
  }

  /**
   * Настройка подписок на события
   */
  _setupSubscriptions() {
    this._subscriptions.push(
      this.stateMachine.subscribe(s => { 
        this.elements.book.dataset.state = s; 
        this._updateDebug(); 
      }),
      this.paginator.on("progress", ({ phase, progress }) => {
        this.loadingIndicator.setPhase(phase, progress);
      }),
      mediaQueries.subscribe(() => { 
        cssVars.invalidateCache(); 
        this.stateMachine.isOpened && this._repaginate(true); 
      })
    );
  }

  /**
   * Обработка изменения размера окна
   */
  _bindResize() {
    let timer = null;
    this.eventManager.add(window, "resize", () => {
      timer && this.timerManager.clearTimeout(timer);
      timer = this.timerManager.setTimeout(() => {
        if (this.stateMachine.isOpened && !this.isDestroyed) {
          cssVars.invalidateCache();
          this._repaginate(true);
        }
      }, cssVars.getTime("--timing-resize-debounce", 150));
    });
  }

  /**
   * Репагинация контента
   * @param {boolean} keepIndex - сохранить текущую страницу
   */
  _repaginate(keepIndex) { 
    return this.lifecycleDelegate.repaginate(keepIndex); 
  }

  /**
   * Обновить панель отладки
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