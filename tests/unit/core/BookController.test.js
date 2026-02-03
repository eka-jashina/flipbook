/**
 * Unit tests for BookController
 * Main application coordinator with dependency injection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════════════

// Hoist mocks for config and utilities
const { mockMediaQueries, mockConfig, mockDelegateEvents } = vi.hoisted(() => ({
  mockMediaQueries: {
    isMobile: false,
    get: vi.fn((key) => key === 'mobile' ? false : null),
  },
  mockConfig: {
    CHAPTERS: [
      { id: 'ch1', file: 'content/part_1.html', bg: 'images/bg1.webp' },
      { id: 'ch2', file: 'content/part_2.html', bg: 'images/bg2.webp' },
    ],
    VIRTUALIZATION: { cacheLimit: 12 },
    DEFAULT_SETTINGS: {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      page: 0,
      soundEnabled: true,
      soundVolume: 0.3,
    },
  },
  mockDelegateEvents: {
    INDEX_CHANGE: 'indexChange',
    BOOK_OPEN: 'bookOpen',
    BOOK_CLOSE: 'bookClose',
    PAGINATION_COMPLETE: 'paginationComplete',
    CHAPTER_UPDATE: 'chapterUpdate',
    SETTINGS_UPDATE: 'settingsUpdate',
    REPAGINATE: 'repaginate',
  },
}));

// Store all mock instances for test assertions
let mockInstances = {};

// Reset mock instances before each test
const resetMockInstances = () => {
  mockInstances = {
    coreServices: null,
    audioServices: null,
    renderServices: null,
    contentServices: null,
    settings: null,
    stateMachine: null,
    debugPanel: null,
    eventController: null,
    navigationDelegate: null,
    lifecycleDelegate: null,
    settingsDelegate: null,
    chapterDelegate: null,
    dragDelegate: null,
    appInitializer: null,
    subscriptionManager: null,
    resizeHandler: null,
  };
};

// Mock utils
vi.mock('../../../js/utils/index.js', () => ({
  mediaQueries: mockMediaQueries,
}));

// Mock config
vi.mock('../../../js/config.js', () => ({
  CONFIG: mockConfig,
  BookState: {
    CLOSED: 'CLOSED',
    OPENING: 'OPENING',
    OPENED: 'OPENED',
    FLIPPING: 'FLIPPING',
    CLOSING: 'CLOSING',
  },
  Direction: {
    NEXT: 'next',
    PREV: 'prev',
  },
}));

// Mock ComponentFactory
vi.mock('../../../js/core/ComponentFactory.js', () => ({
  ComponentFactory: class MockComponentFactory {
    static createCoreServices() {
      mockInstances.coreServices = {
        dom: {
          get: vi.fn((key) => {
            const el = document.createElement('div');
            if (key === 'currentPage' || key === 'totalPages') {
              return document.createElement('span');
            }
            return el;
          }),
          getMultiple: vi.fn((...keys) => {
            const result = {};
            keys.forEach(key => {
              result[key] = document.createElement('div');
            });
            return result;
          }),
        },
        eventManager: {
          add: vi.fn(),
          remove: vi.fn(),
          removeAll: vi.fn(),
          count: 0,
        },
        timerManager: {
          setTimeout: vi.fn((fn) => { fn(); return 1; }),
          clearTimeout: vi.fn(),
          debounce: vi.fn((fn) => fn),
          clearAll: vi.fn(),
        },
        storage: {
          load: vi.fn(() => ({})),
          save: vi.fn(),
        },
        destroy: vi.fn(),
      };
      return mockInstances.coreServices;
    }

    constructor(core) {
      this.core = core;
    }

    createSettingsManager() {
      mockInstances.settings = {
        get: vi.fn((key) => mockConfig.DEFAULT_SETTINGS[key]),
        set: vi.fn(),
        getAll: vi.fn(() => ({ ...mockConfig.DEFAULT_SETTINGS })),
        destroy: vi.fn(),
      };
      return mockInstances.settings;
    }

    createAudioServices(settings) {
      mockInstances.audioServices = {
        soundManager: {
          play: vi.fn(),
          setVolume: vi.fn(),
        },
        ambientManager: {
          play: vi.fn(),
          stop: vi.fn(),
          setVolume: vi.fn(),
        },
        setupAmbientLoadingCallbacks: vi.fn(),
        destroy: vi.fn(),
      };
      return mockInstances.audioServices;
    }

    createRenderServices() {
      mockInstances.renderServices = {
        renderer: {
          pageContents: [],
          setPageContents: vi.fn(),
          renderSpread: vi.fn(),
          cacheSize: 0,
        },
        animator: {
          runFlip: vi.fn().mockResolvedValue(undefined),
        },
        paginator: {
          on: vi.fn(),
          paginate: vi.fn().mockResolvedValue({ pages: [], chapterStarts: [] }),
        },
        loadingIndicator: {
          show: vi.fn(),
          hide: vi.fn(),
        },
        destroy: vi.fn(),
      };
      return mockInstances.renderServices;
    }

    createContentServices() {
      mockInstances.contentServices = {
        contentLoader: {
          load: vi.fn().mockResolvedValue('<article>Test</article>'),
        },
        backgroundManager: {
          preloadAll: vi.fn().mockResolvedValue(undefined),
          getForChapter: vi.fn(() => 'images/bg1.webp'),
        },
        destroy: vi.fn(),
      };
      return mockInstances.contentServices;
    }

    createStateMachine() {
      mockInstances.stateMachine = {
        state: 'CLOSED',
        get isClosed() { return this.state === 'CLOSED'; },
        get isOpened() { return this.state === 'OPENED'; },
        get isBusy() { return ['OPENING', 'CLOSING', 'FLIPPING'].includes(this.state); },
        transitionTo: vi.fn(function(newState) {
          this.state = newState;
          return true;
        }),
        subscribe: vi.fn(() => vi.fn()),
        destroy: vi.fn(),
      };
      return mockInstances.stateMachine;
    }

    createDebugPanel() {
      mockInstances.debugPanel = {
        update: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
      };
      return mockInstances.debugPanel;
    }

    createEventController(handlers) {
      mockInstances.eventController = {
        bind: vi.fn(),
        destroy: vi.fn(),
        handlers,
      };
      return mockInstances.eventController;
    }
  },
}));

// Mock SubscriptionManager using class
vi.mock('../../../js/core/SubscriptionManager.js', () => ({
  SubscriptionManager: class MockSubscriptionManager {
    constructor() {
      this.subscribeToState = vi.fn();
      this.subscribeToPagination = vi.fn();
      this.subscribeToMediaQueries = vi.fn();
      this.unsubscribeAll = vi.fn();
      mockInstances.subscriptionManager = this;
    }
  },
}));

// Mock ResizeHandler using class
vi.mock('../../../js/core/ResizeHandler.js', () => ({
  ResizeHandler: class MockResizeHandler {
    constructor() {
      this.bind = vi.fn();
      this.destroy = vi.fn();
      mockInstances.resizeHandler = this;
    }
  },
}));

// Mock AppInitializer using class
vi.mock('../../../js/core/AppInitializer.js', () => ({
  AppInitializer: class MockAppInitializer {
    constructor() {
      this.initialize = vi.fn().mockResolvedValue(undefined);
      mockInstances.appInitializer = this;
    }
  },
}));

// Helper to create delegate mock methods
const createDelegateMockMethods = () => {
  const handlers = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event).push(handler);
      return () => {
        const list = handlers.get(event);
        const idx = list.indexOf(handler);
        if (idx > -1) list.splice(idx, 1);
      };
    }),
    emit: vi.fn((event, ...args) => {
      const list = handlers.get(event) || [];
      list.forEach(h => h(...args));
    }),
    destroy: vi.fn(),
    __handlers: handlers,
  };
};

// Mock delegates using classes
vi.mock('../../../js/core/delegates/index.js', () => ({
  NavigationDelegate: class MockNavigationDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.flip = vi.fn().mockResolvedValue(undefined);
      this.handleTOCNavigation = vi.fn();
      mockInstances.navigationDelegate = this;
    }
  },
  LifecycleDelegate: class MockLifecycleDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.open = vi.fn().mockResolvedValue(undefined);
      this.close = vi.fn().mockResolvedValue(undefined);
      this.repaginate = vi.fn().mockResolvedValue(undefined);
      mockInstances.lifecycleDelegate = this;
    }
  },
  SettingsDelegate: class MockSettingsDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.handleChange = vi.fn();
      this.applyAll = vi.fn();
      mockInstances.settingsDelegate = this;
    }
  },
  ChapterDelegate: class MockChapterDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.updateBackground = vi.fn();
      mockInstances.chapterDelegate = this;
    }
  },
  DragDelegate: class MockDragDelegate {
    constructor() {
      const methods = createDelegateMockMethods();
      Object.assign(this, methods);
      this.isActive = false;
      this.bind = vi.fn();
      mockInstances.dragDelegate = this;
    }
  },
  DelegateEvents: mockDelegateEvents,
}));

// Import after mocks
const { BookController } = await import('../../../js/core/BookController.js');

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('BookController', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(controller.state).toEqual({
        index: 0,
        chapterStarts: [],
      });
    });

    it('should set isDestroyed to false', () => {
      expect(controller.isDestroyed).toBe(false);
    });

    it('should create all service groups', () => {
      expect(controller.core).toBeDefined();
      expect(controller.audio).toBeDefined();
      expect(controller.render).toBeDefined();
      expect(controller.content).toBeDefined();
    });

    it('should create settings manager', () => {
      expect(controller.settings).toBeDefined();
      expect(typeof controller.settings.get).toBe('function');
    });

    it('should create state machine', () => {
      expect(controller.stateMachine).toBeDefined();
    });

    it('should create all delegates', () => {
      expect(controller.navigationDelegate).toBeDefined();
      expect(controller.lifecycleDelegate).toBeDefined();
      expect(controller.settingsDelegate).toBeDefined();
      expect(controller.chapterDelegate).toBeDefined();
      expect(controller.dragDelegate).toBeDefined();
    });

    it('should create event controller', () => {
      expect(controller.eventController).toBeDefined();
    });

    it('should create debug panel', () => {
      expect(controller.debugPanel).toBeDefined();
    });

    it('should setup subscription manager', () => {
      expect(controller.subscriptions).toBeDefined();
    });

    it('should setup resize handler', () => {
      expect(controller.resizeHandler).toBeDefined();
    });

    it('should setup ambient loading callbacks', () => {
      expect(mockInstances.audioServices.setupAmbientLoadingCallbacks).toHaveBeenCalled();
    });
  });

  describe('computed properties', () => {
    describe('isMobile', () => {
      it('should return mediaQueries.isMobile value (false)', () => {
        mockMediaQueries.isMobile = false;
        expect(controller.isMobile).toBe(false);
      });

      it('should return mediaQueries.isMobile value (true)', () => {
        mockMediaQueries.isMobile = true;
        expect(controller.isMobile).toBe(true);
        mockMediaQueries.isMobile = false; // Reset
      });
    });

    describe('index', () => {
      it('should get index from state', () => {
        controller.state.index = 5;
        expect(controller.index).toBe(5);
      });

      it('should set index in state', () => {
        controller.index = 10;
        expect(controller.state.index).toBe(10);
      });
    });

    describe('chapterStarts', () => {
      it('should get chapterStarts from state', () => {
        controller.state.chapterStarts = [0, 50, 100];
        expect(controller.chapterStarts).toEqual([0, 50, 100]);
      });

      it('should set chapterStarts in state', () => {
        controller.chapterStarts = [0, 30, 60];
        expect(controller.state.chapterStarts).toEqual([0, 30, 60]);
      });
    });
  });

  describe('delegate event subscriptions', () => {
    it('should subscribe to NavigationDelegate INDEX_CHANGE', () => {
      expect(mockInstances.navigationDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.INDEX_CHANGE,
        expect.any(Function)
      );
    });

    it('should subscribe to NavigationDelegate BOOK_OPEN', () => {
      expect(mockInstances.navigationDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.BOOK_OPEN,
        expect.any(Function)
      );
    });

    it('should subscribe to NavigationDelegate BOOK_CLOSE', () => {
      expect(mockInstances.navigationDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.BOOK_CLOSE,
        expect.any(Function)
      );
    });

    it('should subscribe to LifecycleDelegate PAGINATION_COMPLETE', () => {
      expect(mockInstances.lifecycleDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.PAGINATION_COMPLETE,
        expect.any(Function)
      );
    });

    it('should subscribe to LifecycleDelegate INDEX_CHANGE', () => {
      expect(mockInstances.lifecycleDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.INDEX_CHANGE,
        expect.any(Function)
      );
    });

    it('should subscribe to LifecycleDelegate CHAPTER_UPDATE', () => {
      expect(mockInstances.lifecycleDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.CHAPTER_UPDATE,
        expect.any(Function)
      );
    });

    it('should subscribe to SettingsDelegate SETTINGS_UPDATE', () => {
      expect(mockInstances.settingsDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.SETTINGS_UPDATE,
        expect.any(Function)
      );
    });

    it('should subscribe to SettingsDelegate REPAGINATE', () => {
      expect(mockInstances.settingsDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.REPAGINATE,
        expect.any(Function)
      );
    });

    it('should subscribe to DragDelegate INDEX_CHANGE', () => {
      expect(mockInstances.dragDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.INDEX_CHANGE,
        expect.any(Function)
      );
    });

    it('should subscribe to DragDelegate CHAPTER_UPDATE', () => {
      expect(mockInstances.dragDelegate.on).toHaveBeenCalledWith(
        mockDelegateEvents.CHAPTER_UPDATE,
        expect.any(Function)
      );
    });
  });

  describe('init', () => {
    it('should call initializer.initialize', async () => {
      await controller.init();
      expect(mockInstances.appInitializer.initialize).toHaveBeenCalled();
    });

    it('should subscribe to state machine', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToState).toHaveBeenCalled();
    });

    it('should subscribe to paginator', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToPagination).toHaveBeenCalled();
    });

    it('should subscribe to media queries', async () => {
      await controller.init();
      expect(mockInstances.subscriptionManager.subscribeToMediaQueries).toHaveBeenCalled();
    });

    it('should bind resize handler', async () => {
      await controller.init();
      expect(mockInstances.resizeHandler.bind).toHaveBeenCalled();
    });

    it('should not initialize if already destroyed', async () => {
      controller.isDestroyed = true;
      await controller.init();
      expect(mockInstances.appInitializer.initialize).not.toHaveBeenCalled();
    });

    it('should update debug panel after init', async () => {
      await controller.init();
      expect(mockInstances.debugPanel.update).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should set isDestroyed to true', () => {
      controller.destroy();
      expect(controller.isDestroyed).toBe(true);
    });

    it('should unsubscribe all subscriptions', () => {
      controller.destroy();
      expect(mockInstances.subscriptionManager.unsubscribeAll).toHaveBeenCalled();
    });

    it('should destroy resize handler', () => {
      controller.destroy();
      expect(mockInstances.resizeHandler.destroy).toHaveBeenCalled();
    });

    it('should destroy all delegates', () => {
      controller.destroy();
      expect(mockInstances.navigationDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.lifecycleDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.settingsDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.chapterDelegate.destroy).toHaveBeenCalled();
      expect(mockInstances.dragDelegate.destroy).toHaveBeenCalled();
    });

    it('should destroy event controller', () => {
      controller.destroy();
      expect(mockInstances.eventController.destroy).toHaveBeenCalled();
    });

    it('should destroy service groups', () => {
      controller.destroy();

      expect(mockInstances.audioServices.destroy).toHaveBeenCalled();
      expect(mockInstances.renderServices.destroy).toHaveBeenCalled();
      expect(mockInstances.contentServices.destroy).toHaveBeenCalled();
      expect(mockInstances.coreServices.destroy).toHaveBeenCalled();
    });

    it('should nullify state', () => {
      controller.destroy();
      expect(controller.state).toBeNull();
    });

    it('should nullify service references', () => {
      controller.destroy();
      expect(controller.core).toBeNull();
      expect(controller.audio).toBeNull();
      expect(controller.render).toBeNull();
      expect(controller.content).toBeNull();
    });

    it('should not destroy twice', () => {
      controller.destroy();

      // Reset call counts after first destroy
      vi.clearAllMocks();

      controller.destroy();
      // Should not call destroy methods again
      expect(mockInstances.subscriptionManager.unsubscribeAll).not.toHaveBeenCalled();
    });
  });

  describe('_handleIndexChange', () => {
    it('should update state index', () => {
      controller._handleIndexChange(5);
      expect(controller.state.index).toBe(5);
    });

    it('should save page to settings', () => {
      controller._handleIndexChange(10);
      expect(mockInstances.settings.set).toHaveBeenCalledWith('page', 10);
    });

    it('should update chapter background', () => {
      controller._handleIndexChange(5);
      expect(mockInstances.chapterDelegate.updateBackground).toHaveBeenCalled();
    });

    it('should update debug panel', () => {
      controller._handleIndexChange(5);
      expect(mockInstances.debugPanel.update).toHaveBeenCalled();
    });
  });

  describe('_handlePaginationComplete', () => {
    it('should set page contents on renderer', () => {
      const pages = ['<p>Page 1</p>', '<p>Page 2</p>'];
      const chapterStarts = [0];

      controller._handlePaginationComplete(pages, chapterStarts);

      expect(mockInstances.renderServices.renderer.setPageContents).toHaveBeenCalledWith(pages);
    });

    it('should update chapterStarts in state', () => {
      const pages = ['<p>Page 1</p>'];
      const chapterStarts = [0, 10, 20];

      controller._handlePaginationComplete(pages, chapterStarts);

      expect(controller.state.chapterStarts).toEqual([0, 10, 20]);
    });
  });

  describe('_handleBookOpen', () => {
    it('should call lifecycleDelegate.open with startIndex 0 when not continuing', async () => {
      await controller._handleBookOpen(false);
      expect(mockInstances.lifecycleDelegate.open).toHaveBeenCalledWith(0);
    });

    it('should call lifecycleDelegate.open with saved page when continuing', async () => {
      mockInstances.settings.get = vi.fn((key) => {
        if (key === 'page') return 42;
        return null;
      });

      await controller._handleBookOpen(true);
      expect(mockInstances.lifecycleDelegate.open).toHaveBeenCalledWith(42);
    });
  });

  describe('_handleBookClose', () => {
    it('should call lifecycleDelegate.close', async () => {
      await controller._handleBookClose();
      expect(mockInstances.lifecycleDelegate.close).toHaveBeenCalled();
    });
  });

  describe('_repaginate', () => {
    it('should call lifecycleDelegate.repaginate with keepIndex true', async () => {
      await controller._repaginate(true);
      expect(mockInstances.lifecycleDelegate.repaginate).toHaveBeenCalledWith(true);
    });

    it('should call lifecycleDelegate.repaginate with keepIndex false', async () => {
      await controller._repaginate(false);
      expect(mockInstances.lifecycleDelegate.repaginate).toHaveBeenCalledWith(false);
    });
  });

  describe('_updateChapterBackground', () => {
    it('should call chapterDelegate.updateBackground with current index and mobile state', () => {
      controller.state.index = 15;
      mockMediaQueries.isMobile = true;

      controller._updateChapterBackground();

      expect(mockInstances.chapterDelegate.updateBackground).toHaveBeenCalledWith(15, true);

      mockMediaQueries.isMobile = false; // Reset
    });
  });

  describe('_updateDebug', () => {
    it('should call debugPanel.update with correct data', () => {
      controller.state.index = 5;
      controller.render.renderer.pageContents = new Array(100);
      controller.render.renderer.cacheSize = 8;

      controller._updateDebug();

      expect(mockInstances.debugPanel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPage: 5,
          cacheLimit: 12,
        })
      );
    });
  });

  describe('_updateNavigationUI', () => {
    let currentPageEl;
    let totalPagesEl;
    let progressBar;

    beforeEach(() => {
      currentPageEl = document.createElement('span');
      totalPagesEl = document.createElement('span');
      progressBar = document.createElement('div');

      // Wrap in page-counter for aria-label test
      const pageCounter = document.createElement('div');
      pageCounter.className = 'page-counter';
      pageCounter.appendChild(currentPageEl);

      mockInstances.coreServices.dom.get = vi.fn((key) => {
        if (key === 'currentPage') return currentPageEl;
        if (key === 'totalPages') return totalPagesEl;
        if (key === 'readingProgress') return progressBar;
        return null;
      });

      controller.render.renderer.pageContents = new Array(100);
      controller.state.index = 49;
    });

    it('should update current page display (1-based)', () => {
      controller._updateNavigationUI();
      expect(currentPageEl.textContent).toBe('50');
    });

    it('should update total pages display', () => {
      controller._updateNavigationUI();
      expect(totalPagesEl.textContent).toBe('100');
    });

    it('should update progress bar CSS variable', () => {
      controller._updateNavigationUI();
      expect(progressBar.style.getPropertyValue('--progress-width')).toBe('50%');
    });

    it('should update progress bar aria-valuenow', () => {
      controller._updateNavigationUI();
      expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
    });

    it('should handle missing elements gracefully', () => {
      mockInstances.coreServices.dom.get = vi.fn(() => null);
      expect(() => controller._updateNavigationUI()).not.toThrow();
    });

    it('should handle zero total pages', () => {
      controller.render.renderer.pageContents = [];
      controller.state.index = 0;

      expect(() => controller._updateNavigationUI()).not.toThrow();
    });
  });
});

describe('BookController event controller callbacks', () => {
  let controller;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockInstances();
    controller = new BookController();
  });

  afterEach(() => {
    controller?.destroy();
  });

  it('should pass onFlip callback to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.onFlip).toBeDefined();
    expect(typeof handlers.onFlip).toBe('function');
  });

  it('should pass onTOCClick callback to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.onTOCClick).toBeDefined();
    expect(typeof handlers.onTOCClick).toBe('function');
  });

  it('should pass onOpen callback to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.onOpen).toBeDefined();
    expect(typeof handlers.onOpen).toBe('function');
  });

  it('should pass onSettings callback to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.onSettings).toBeDefined();
    expect(typeof handlers.onSettings).toBe('function');
  });

  it('should pass isBusy check to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.isBusy).toBeDefined();
    expect(typeof handlers.isBusy).toBe('function');
  });

  it('should pass isOpened check to eventController', () => {
    const handlers = mockInstances.eventController.handlers;
    expect(handlers.isOpened).toBeDefined();
    expect(typeof handlers.isOpened).toBe('function');
  });

  it('isBusy should return true when stateMachine is busy', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'FLIPPING';

    expect(handlers.isBusy()).toBe(true);
  });

  it('isBusy should return true when dragDelegate is active', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'OPENED';
    mockInstances.dragDelegate.isActive = true;

    expect(handlers.isBusy()).toBe(true);
  });

  it('isBusy should return false when neither busy nor dragging', () => {
    const handlers = mockInstances.eventController.handlers;
    mockInstances.stateMachine.state = 'OPENED';
    mockInstances.dragDelegate.isActive = false;

    expect(handlers.isBusy()).toBe(false);
  });

  it('isOpened should return stateMachine.isOpened', () => {
    const handlers = mockInstances.eventController.handlers;

    mockInstances.stateMachine.state = 'OPENED';
    expect(handlers.isOpened()).toBe(true);

    mockInstances.stateMachine.state = 'CLOSED';
    expect(handlers.isOpened()).toBe(false);
  });

  it('onFlip callback should call navigationDelegate.flip', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onFlip('next');

    expect(mockInstances.navigationDelegate.flip).toHaveBeenCalledWith('next');
  });

  it('onTOCClick callback should call navigationDelegate.handleTOCNavigation', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onTOCClick(2);

    expect(mockInstances.navigationDelegate.handleTOCNavigation).toHaveBeenCalledWith(2);
  });

  it('onSettings callback should call settingsDelegate.handleChange', () => {
    const handlers = mockInstances.eventController.handlers;
    handlers.onSettings('theme', 'dark');

    expect(mockInstances.settingsDelegate.handleChange).toHaveBeenCalledWith('theme', 'dark');
  });
});
