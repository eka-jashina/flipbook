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
import { DragController } from './DragController.js';

// Делегаты
import { NavigationDelegate } from './delegates/NavigationDelegate.js';
import { SettingsDelegate } from './delegates/SettingsDelegate.js';
import { LifecycleDelegate } from './delegates/LifecycleDelegate.js';
import { ChapterDelegate } from './delegates/ChapterDelegate.js';

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

  async init() {
    if (this.isDestroyed) return;
    try {
      this._setupSubscriptions();
      this.settingsDelegate.apply();
      this._initUI();
      this._bindResize();
      await document.fonts.ready;

      // Предзагружаем обложку и первый фон
      await this.lifecycleDelegate.init();

      this._updateDebug();
    } catch (error) {
      ErrorHandler.handle(error, "Ошибка инициализации");
    }
  }

  // Делегируем в NavigationDelegate
  flip(direction) { return this.navigationDelegate.flip(direction); }
  handleTOCNavigation(chapter) { return this.navigationDelegate.handleTOCNavigation(chapter); }

  // Делегируем в LifecycleDelegate  
  openBook(startIndex = 0) { return this.lifecycleDelegate.open(startIndex); }
  closeBook() { return this.lifecycleDelegate.close(); }

  // Делегируем в SettingsDelegate
  handleSettingsChange(key, value) { return this.settingsDelegate.handleChange(key, value); }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this._subscriptions.forEach(unsub => typeof unsub === "function" && unsub());
    this._subscriptions = [];

    [this.animator, this.paginator, this.contentLoader, this.backgroundManager,
     this.eventController, this.stateMachine, this.settings, this.dragController].forEach(c => c?.destroy?.());

    this.eventManager.clear();
    this.timerManager.clear();

    ['leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack']
      .forEach(id => this.elements[id] && (this.elements[id].innerHTML = ""));

    this.elements = null;
  }

  // === ВНУТРЕННИЕ МЕТОДЫ ===

  _initManagers() {
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.stateMachine = new BookStateMachine();
    this.storage = new StorageManager(CONFIG.STORAGE_KEY);
    this.settings = new SettingsManager(this.storage, CONFIG.DEFAULT_SETTINGS);
  }

  _cacheElements() {
    const $ = id => document.getElementById(id);
    this.elements = {
      html: document.documentElement,
      body: document.body,
      book: $("book"), bookWrap: $("book-wrap"), cover: $("cover"),
      leftA: $("leftA"), rightA: $("rightA"), leftB: $("leftB"), rightB: $("rightB"),
      sheet: $("sheet"), sheetFront: $("sheetFront"), sheetBack: $("sheetBack"),
      flipShadow: $("flipShadow"), // Элемент тени от переворота
      loadingOverlay: $("loadingOverlay"), loadingProgress: $("loadingProgress"),
      nextBtn: $("next"), prevBtn: $("prev"), tocBtn: $("tocBtn"), continueBtn: $("continueBtn"),
      increaseBtn: $("increase"), decreaseBtn: $("decrease"),
      fontSelect: $("font-select"), themeSelect: $("theme-select"), debugToggle: $("debugToggle"),
      debugInfo: $("debugInfo"), debugState: $("debugState"), debugTotal: $("debugTotal"),
      debugCurrent: $("debugCurrent"), debugCache: $("debugCache"),
      debugMemory: $("debugMemory"), debugListeners: $("debugListeners"),
    };
  }

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
    this.loadingIndicator = new LoadingIndicator(this.elements.loadingOverlay, this.elements.loadingProgress);
    this.debugPanel = new DebugPanel({ container: this.elements.debugInfo, state: this.elements.debugState,
      total: this.elements.debugTotal, current: this.elements.debugCurrent,
      cache: this.elements.debugCache, memory: this.elements.debugMemory, listeners: this.elements.debugListeners });
    this.eventController = new EventController({
      book: this.elements.book, eventManager: this.eventManager,
      onFlip: dir => this.flip(dir),
      onTOCClick: ch => this.handleTOCNavigation(ch),
      onOpen: cont => this.openBook(cont ? this.settings.get("page") : 0),
      onSettings: (k, v) => this.handleSettingsChange(k, v),
      isBusy: () => this.stateMachine.isBusy || this.dragController?.isActive,
      isOpened: () => this.stateMachine.isOpened,
    });
    
    // Drag Controller с поддержкой flip-shadow
    this.dragController = new DragController({
      book: this.elements.book,
      sheet: this.elements.sheet,
      flipShadow: this.elements.flipShadow, // Передаём элемент тени
      eventManager: this.eventManager,
      onDragStart: (dir) => this._handleDragStart(dir),
      onDragEnd: (completed, dir) => this._handleDragEnd(completed, dir),
      canFlipNext: () => this._canDragNext(),
      canFlipPrev: () => this._canDragPrev(),
      isBusy: () => this.stateMachine.isBusy,
    });
  }

  _initDelegates() {
    this.navigationDelegate = new NavigationDelegate(this);
    this.settingsDelegate = new SettingsDelegate(this);
    this.lifecycleDelegate = new LifecycleDelegate(this);
    this.chapterDelegate = new ChapterDelegate(this);
  }

  _initState() {
    this.index = 0;
    this.chapterStarts = [];
    this.isDestroyed = false;
    this._subscriptions = [];
    this._dragDirection = null;
    this._dragPageRefs = null;
  }

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
    
    // Привязываем drag controller
    this.dragController.bind();
  }

  _setupSubscriptions() {
    this._subscriptions.push(
      this.stateMachine.subscribe(s => { this.elements.book.dataset.state = s; this._updateDebug(); }),
      this.paginator.on("progress", ({ phase, progress }) => this.loadingIndicator.setPhase(phase, progress)),
      mediaQueries.subscribe(() => { cssVars.invalidateCache(); this.stateMachine.isOpened && this._repaginate(true); })
    );
  }

  _bindResize() {
    let timer = null;
    this.eventManager.add(window, "resize", () => {
      timer && this.timerManager.clearTimeout(timer);
      timer = this.timerManager.setTimeout(() => {
        this.stateMachine.isOpened && !this.isDestroyed && (cssVars.invalidateCache(), this._repaginate(true));
      }, cssVars.getTime("--timing-resize-debounce", 150));
    });
  }

  _repaginate(keepIndex) { return this.lifecycleDelegate.repaginate(keepIndex); }

  _updateDebug() {
    this.debugPanel.update({
      state: this.stateMachine.state, totalPages: this.renderer.pageContents.length,
      currentPage: this.index, cacheSize: this.renderer.cacheSize,
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit, listenerCount: this.eventManager.count,
    });
  }

  // === DRAG HANDLERS ===

  /**
   * Проверка возможности drag вперёд
   */
  _canDragNext() {
    if (!this.stateMachine.isOpened) return false;
    const step = this.pagesPerFlip;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    return this.index + step <= maxIndex;
  }

  /**
   * Проверка возможности drag назад
   */
  _canDragPrev() {
    if (!this.stateMachine.isOpened) return false;
    return this.index > 0;
  }

  /**
   * Начало drag - подготовить sheet и буферы
   */
  _handleDragStart(direction) {
    this._dragDirection = direction;
    
    const step = this.pagesPerFlip;
    const nextIndex = direction === 'next' 
      ? this.index + step 
      : this.index - step;
    
    // Подготавливаем буфер (следующий/предыдущий разворот)
    this.renderer.prepareBuffer(nextIndex, this.isMobile);
    
    // Подготавливаем sheet (лицо и оборот переворачиваемой страницы)
    this.renderer.prepareSheet(this.index, direction, this.isMobile);
    
    // Показываем страницу ПОД переворачиваемой
    // next: переворачиваем правую → показываем левый буфер (следующая левая)
    // prev: переворачиваем левую → показываем правый буфер (предыдущая правая)
    this._showUnderPage(direction);
    
    // Обновляем состояние книги для CSS
    this.elements.book.dataset.state = 'flipping';
  }

  /**
   * Показать страницу под переворачиваемой при drag
   */
  _showUnderPage(direction) {
    const { leftActive, rightActive } = this.renderer.elements;
    const { leftBuffer, rightBuffer } = this.renderer.elements;
    
    // Сохраняем ссылки для cleanup после swap
    this._dragPageRefs = { leftActive, rightActive, leftBuffer, rightBuffer };
    
    if (this.isMobile) {
      rightBuffer.dataset.buffer = 'false';
      rightBuffer.dataset.dragVisible = 'true';
    } else {
      if (direction === 'next') {
        // Переворачиваем правую страницу → под ней следующая ПРАВАЯ
        rightBuffer.dataset.buffer = 'false';
        rightBuffer.dataset.dragVisible = 'true';
        // Скрываем текущую правую (её заменяет sheet)
        rightActive.style.visibility = 'hidden';
      } else {
        // Переворачиваем левую страницу → под ней предыдущая ЛЕВАЯ
        leftBuffer.dataset.buffer = 'false';
        leftBuffer.dataset.dragVisible = 'true';
        // Скрываем текущую левую (её заменяет sheet)
        leftActive.style.visibility = 'hidden';
      }
    }
  }

  /**
   * Скрыть страницу под переворачиваемой
   * @param {boolean} completed - true если переворот завершён, false если отменён
   */
  _hideUnderPage(completed) {
    // Используем сохранённые ссылки (до swap)
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this._dragPageRefs || this.renderer.elements;
    
    // Убираем drag-атрибуты
    delete leftBuffer.dataset.dragVisible;
    delete rightBuffer.dataset.dragVisible;
    leftActive.style.visibility = '';
    rightActive.style.visibility = '';
    
    // При отмене возвращаем буферы в скрытое состояние
    // При завершении это уже сделал swapBuffers
    if (!completed) {
      leftBuffer.dataset.buffer = 'true';
      rightBuffer.dataset.buffer = 'true';
    }
    
    this._dragPageRefs = null;
  }

  /**
   * Конец drag - применить или откатить изменения
   */
  _handleDragEnd(completed, direction) {
    if (completed) {
      // Отключаем transition СРАЗУ, до любых изменений
      this.elements.book.dataset.noTransition = 'true';
      
      // Переворот завершён - обновляем индекс и меняем буферы
      const step = this.pagesPerFlip;
      this.index = direction === 'next' 
        ? this.index + step 
        : this.index - step;
      
      // СНАЧАЛА swap - буферы станут active и видимыми
      this.renderer.swapBuffers();
      
      // ПОТОМ убираем drag-атрибуты
      this._hideUnderPage(true);
      
      this.settings.set("page", this.index);
      this.chapterDelegate.updateChapterUI();
      
      // Включаем transition обратно после двух кадров отрисовки
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          delete this.elements.book.dataset.noTransition;
        });
      });
    } else {
      // Отмена - просто убираем drag-атрибуты
      this._hideUnderPage(false);
    }
    
    // Возвращаем состояние
    this.elements.book.dataset.state = 'opened';
    this._dragDirection = null;
    this._updateDebug();
  }
}