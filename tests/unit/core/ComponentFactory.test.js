/**
 * Тесты для ComponentFactory
 * Фабрика для создания компонентов приложения
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFactory } from '../../../js/core/ComponentFactory.js';

// Mock all imports
vi.mock('../../../js/config.js', () => ({
  CONFIG: {
    DEFAULT_SETTINGS: {
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    },
    SOUNDS: {
      pageFlip: '/sounds/page-flip.mp3',
      bookOpen: '/sounds/cover-flip.mp3',
      bookClose: '/sounds/cover-flip.mp3',
    },
    AMBIENT: {
      none: { label: 'None', file: null },
      rain: { label: 'Rain', file: '/sounds/ambient/rain.mp3' },
    },
    VIRTUALIZATION: {
      cacheLimit: 12,
    },
  },
}));

vi.mock('../../../js/utils/HTMLSanitizer.js', () => ({
  sanitizer: { sanitize: vi.fn() },
}));

vi.mock('../../../js/managers/index.js', () => {
  const BookStateMachine = vi.fn(function() { this.type = 'stateMachine'; });
  const SettingsManager = vi.fn(function() { this.type = 'settingsManager'; });
  const BackgroundManager = vi.fn(function() { this.type = 'backgroundManager'; });
  const ContentLoader = vi.fn(function() { this.type = 'contentLoader'; });
  const AsyncPaginator = vi.fn(function() { this.type = 'paginator'; });
  return { BookStateMachine, SettingsManager, BackgroundManager, ContentLoader, AsyncPaginator };
});

vi.mock('../../../js/utils/SoundManager.js', () => {
  const SoundManager = vi.fn(function() {
    this.type = 'soundManager';
    this.register = vi.fn().mockReturnThis();
  });
  return { SoundManager };
});

vi.mock('../../../js/utils/AmbientManager.js', () => {
  const AmbientManager = vi.fn(function() {
    this.type = 'ambientManager';
    this.register = vi.fn().mockReturnThis();
  });
  return { AmbientManager };
});

vi.mock('../../../js/core/BookRenderer.js', () => {
  const BookRenderer = vi.fn(function() { this.type = 'renderer'; });
  return { BookRenderer };
});

vi.mock('../../../js/core/BookAnimator.js', () => {
  const BookAnimator = vi.fn(function() { this.type = 'animator'; });
  return { BookAnimator };
});

vi.mock('../../../js/core/LoadingIndicator.js', () => {
  const LoadingIndicator = vi.fn(function() { this.type = 'loadingIndicator'; });
  return { LoadingIndicator };
});

vi.mock('../../../js/core/DebugPanel.js', () => {
  const DebugPanel = vi.fn(function() { this.type = 'debugPanel'; });
  return { DebugPanel };
});

vi.mock('../../../js/core/EventController.js', () => {
  const EventController = vi.fn(function() { this.type = 'eventController'; });
  return { EventController };
});

import { BookStateMachine, SettingsManager, BackgroundManager, ContentLoader, AsyncPaginator } from '../../../js/managers/index.js';
import { SoundManager } from '../../../js/utils/SoundManager.js';
import { AmbientManager } from '../../../js/utils/AmbientManager.js';
import { BookRenderer } from '../../../js/core/BookRenderer.js';
import { BookAnimator } from '../../../js/core/BookAnimator.js';
import { LoadingIndicator } from '../../../js/core/LoadingIndicator.js';
import { DebugPanel } from '../../../js/core/DebugPanel.js';
import { EventController } from '../../../js/core/EventController.js';

describe('ComponentFactory', () => {
  let factory;
  let mockContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      dom: {
        get: vi.fn().mockReturnValue(document.createElement('div')),
        getMultiple: vi.fn().mockReturnValue({
          leftA: document.createElement('div'),
          rightA: document.createElement('div'),
          leftB: document.createElement('div'),
          rightB: document.createElement('div'),
          sheetFront: document.createElement('div'),
          sheetBack: document.createElement('div'),
          book: document.createElement('div'),
          bookWrap: document.createElement('div'),
          cover: document.createElement('div'),
          sheet: document.createElement('div'),
          loadingOverlay: document.createElement('div'),
          loadingProgress: document.createElement('div'),
          debugInfo: document.createElement('div'),
          debugState: document.createElement('div'),
          debugTotal: document.createElement('div'),
          debugCurrent: document.createElement('div'),
          debugCache: document.createElement('div'),
          debugMemory: document.createElement('div'),
          debugListeners: document.createElement('div'),
        }),
      },
      eventManager: { add: vi.fn() },
      timerManager: { setTimeout: vi.fn() },
      storage: { load: vi.fn(), save: vi.fn() },
    };

    factory = new ComponentFactory(mockContext);
  });

  describe('constructor', () => {
    it('should store dom reference', () => {
      expect(factory.dom).toBe(mockContext.dom);
    });

    it('should store eventManager reference', () => {
      expect(factory.eventManager).toBe(mockContext.eventManager);
    });

    it('should store timerManager reference', () => {
      expect(factory.timerManager).toBe(mockContext.timerManager);
    });

    it('should store storage reference', () => {
      expect(factory.storage).toBe(mockContext.storage);
    });
  });

  describe('createStateMachine', () => {
    it('should create BookStateMachine', () => {
      const result = factory.createStateMachine();

      expect(BookStateMachine).toHaveBeenCalled();
      expect(result.type).toBe('stateMachine');
    });
  });

  describe('createSettingsManager', () => {
    it('should create SettingsManager with storage and defaults', () => {
      const result = factory.createSettingsManager();

      expect(SettingsManager).toHaveBeenCalledWith(
        mockContext.storage,
        expect.objectContaining({ font: 'georgia' })
      );
      expect(result.type).toBe('settingsManager');
    });
  });

  describe('createSoundManager', () => {
    it('should create SoundManager with settings', () => {
      const mockSettings = {
        get: vi.fn((key) => {
          if (key === 'soundEnabled') return true;
          if (key === 'soundVolume') return 0.5;
          return null;
        }),
      };

      const result = factory.createSoundManager(mockSettings);

      expect(SoundManager).toHaveBeenCalledWith({
        enabled: true,
        volume: 0.5,
      });
      expect(result.type).toBe('soundManager');
    });

    it('should register sounds', () => {
      const mockSettings = {
        get: vi.fn().mockReturnValue(true),
      };

      const result = factory.createSoundManager(mockSettings);

      expect(result.register).toHaveBeenCalledWith(
        'pageFlip',
        '/sounds/page-flip.mp3',
        expect.any(Object)
      );
      expect(result.register).toHaveBeenCalledWith(
        'bookOpen',
        '/sounds/cover-flip.mp3',
        expect.any(Object)
      );
    });
  });

  describe('createBackgroundManager', () => {
    it('should create BackgroundManager', () => {
      const result = factory.createBackgroundManager();

      expect(BackgroundManager).toHaveBeenCalled();
      expect(result.type).toBe('backgroundManager');
    });
  });

  describe('createContentLoader', () => {
    it('should create ContentLoader', () => {
      const result = factory.createContentLoader();

      expect(ContentLoader).toHaveBeenCalled();
      expect(result.type).toBe('contentLoader');
    });
  });

  describe('createPaginator', () => {
    it('should create AsyncPaginator with sanitizer', () => {
      const result = factory.createPaginator();

      expect(AsyncPaginator).toHaveBeenCalledWith(
        expect.objectContaining({ sanitizer: expect.any(Object) })
      );
      expect(result.type).toBe('paginator');
    });
  });

  describe('createRenderer', () => {
    it('should create BookRenderer with DOM elements', () => {
      const result = factory.createRenderer();

      expect(mockContext.dom.getMultiple).toHaveBeenCalledWith(
        'leftA', 'rightA', 'leftB', 'rightB', 'sheetFront', 'sheetBack'
      );
      expect(BookRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ cacheLimit: 12 })
      );
      expect(result.type).toBe('renderer');
    });
  });

  describe('createAnimator', () => {
    it('should create BookAnimator with DOM elements', () => {
      const result = factory.createAnimator();

      expect(mockContext.dom.getMultiple).toHaveBeenCalledWith(
        'book', 'bookWrap', 'cover', 'sheet'
      );
      expect(BookAnimator).toHaveBeenCalledWith(
        expect.objectContaining({ timerManager: mockContext.timerManager })
      );
      expect(result.type).toBe('animator');
    });
  });

  describe('createAmbientManager', () => {
    it('should create AmbientManager with settings', () => {
      const mockSettings = {
        get: vi.fn((key) => {
          if (key === 'ambientType') return 'rain';
          if (key === 'ambientVolume') return 0.7;
          return null;
        }),
      };

      const result = factory.createAmbientManager(mockSettings);

      expect(AmbientManager).toHaveBeenCalledWith({
        currentType: 'rain',
        volume: 0.7,
      });
      expect(result.type).toBe('ambientManager');
    });

    it('should register ambient sounds from config', () => {
      const mockSettings = {
        get: vi.fn().mockReturnValue('none'),
      };

      const result = factory.createAmbientManager(mockSettings);

      // Should register rain (has file), but not none (no file)
      expect(result.register).toHaveBeenCalledWith('rain', '/sounds/ambient/rain.mp3');
    });
  });

  describe('createLoadingIndicator', () => {
    it('should create LoadingIndicator with DOM elements', () => {
      const result = factory.createLoadingIndicator();

      expect(mockContext.dom.getMultiple).toHaveBeenCalledWith(
        'loadingOverlay', 'loadingProgress'
      );
      expect(LoadingIndicator).toHaveBeenCalled();
      expect(result.type).toBe('loadingIndicator');
    });
  });

  describe('createDebugPanel', () => {
    it('should create DebugPanel with DOM elements', () => {
      const result = factory.createDebugPanel();

      expect(mockContext.dom.getMultiple).toHaveBeenCalledWith(
        'debugInfo', 'debugState', 'debugTotal', 'debugCurrent',
        'debugCache', 'debugMemory', 'debugListeners'
      );
      expect(DebugPanel).toHaveBeenCalled();
      expect(result.type).toBe('debugPanel');
    });
  });

  describe('createEventController', () => {
    it('should create EventController with handlers', () => {
      const handlers = {
        onFlip: vi.fn(),
        onTOCClick: vi.fn(),
        onOpen: vi.fn(),
        onSettings: vi.fn(),
        isBusy: vi.fn(),
        isOpened: vi.fn(),
      };

      const result = factory.createEventController(handlers);

      expect(mockContext.dom.get).toHaveBeenCalledWith('book');
      expect(EventController).toHaveBeenCalledWith(
        expect.objectContaining({
          book: expect.any(Object),
          eventManager: mockContext.eventManager,
          ...handlers,
        })
      );
      expect(result.type).toBe('eventController');
    });
  });
});
