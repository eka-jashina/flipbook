/**
 * COMPONENT FACTORY
 * Фабрика для создания всех компонентов приложения.
 */

import { CONFIG } from "../config.js";
import { sanitizer } from "../utils/HTMLSanitizer.js";
import { SoundManager } from "../utils/SoundManager.js";
import {
  BookStateMachine,
  SettingsManager,
  BackgroundManager,
  ContentLoader,
  AsyncPaginator,
} from "../managers/index.js";
import { BookRenderer } from "./BookRenderer.js";
import { BookAnimator } from "./BookAnimator.js";
import { LoadingIndicator } from "./LoadingIndicator.js";
import { DebugPanel } from "./DebugPanel.js";
import { EventController } from "./EventController.js";
import { AmbientManager } from "../utils/AmbientManager.js";

export class ComponentFactory {
  /**
   * @param {Object} context - Контекст с общими зависимостями
   */
  constructor(context) {
    this.dom = context.dom;
    this.eventManager = context.eventManager;
    this.timerManager = context.timerManager;
    this.storage = context.storage;
  }

  /**
   * Создать менеджер состояния
   * @returns {BookStateMachine}
   */
  createStateMachine() {
    return new BookStateMachine();
  }

  /**
   * Создать менеджер настроек
   * @returns {SettingsManager}
   */
  createSettingsManager() {
    return new SettingsManager(this.storage, CONFIG.DEFAULT_SETTINGS);
  }

  /**
   * Создать менеджер звуков
   * @param {Object} settings - Настройки из SettingsManager
   * @returns {SoundManager}
   */
  createSoundManager(settings) {
    const soundManager = new SoundManager({
      enabled: settings.get("soundEnabled"),
      volume: settings.get("soundVolume"),
    });

    // Регистрируем звуки
    soundManager
      .register("pageFlip", CONFIG.SOUNDS.pageFlip, {
        preload: true,
        poolSize: 3,
      })
      .register("bookOpen", CONFIG.SOUNDS.bookOpen, {
        preload: true,
        poolSize: 1,
      })
      .register("bookClose", CONFIG.SOUNDS.bookClose, {
        preload: true,
        poolSize: 1,
      });

    return soundManager;
  }

  /**
   * Создать менеджер фонов
   * @returns {BackgroundManager}
   */
  createBackgroundManager() {
    return new BackgroundManager();
  }

  /**
   * Создать загрузчик контента
   * @returns {ContentLoader}
   */
  createContentLoader() {
    return new ContentLoader();
  }

  /**
   * Создать пагинатор
   * @returns {AsyncPaginator}
   */
  createPaginator() {
    return new AsyncPaginator({ sanitizer });
  }

  /**
   * Создать рендерер страниц
   * @returns {BookRenderer}
   */
  createRenderer() {
    const { leftA, rightA, leftB, rightB, sheetFront, sheetBack } =
      this.dom.getMultiple(
        "leftA",
        "rightA",
        "leftB",
        "rightB",
        "sheetFront",
        "sheetBack",
      );

    return new BookRenderer({
      cacheLimit: CONFIG.VIRTUALIZATION.cacheLimit,
      leftActive: leftA,
      rightActive: rightA,
      leftBuffer: leftB,
      rightBuffer: rightB,
      sheetFront: sheetFront,
      sheetBack: sheetBack,
    });
  }

  /**
   * Создать аниматор
   * @returns {BookAnimator}
   */
  createAnimator() {
    const { book, bookWrap, cover, sheet } = this.dom.getMultiple(
      "book",
      "bookWrap",
      "cover",
      "sheet",
    );

    return new BookAnimator({
      book,
      bookWrap,
      cover,
      sheet,
      timerManager: this.timerManager,
    });
  }

  /**
   * Создать менеджер ambient звуков
   * @param {Object} settings - Настройки из SettingsManager
   * @returns {AmbientManager}
   */
  createAmbientManager(settings) {
    const ambientManager = new AmbientManager({
      currentType: settings.get("ambientType"),
      volume: settings.get("ambientVolume"),
    });

    // Регистрируем доступные ambient звуки
    ambientManager
      .register("rain", "public/sounds/ambient/rain.mp3")
      .register("fireplace", "public/sounds/ambient/fireplace.mp3")
      .register("cafe", "public/sounds/ambient/cafe.mp3");

    return ambientManager;
  }

  /**
   * Создать индикатор загрузки
   * @returns {LoadingIndicator}
   */
  createLoadingIndicator() {
    const { loadingOverlay, loadingProgress } = this.dom.getMultiple(
      "loadingOverlay",
      "loadingProgress",
    );

    return new LoadingIndicator(loadingOverlay, loadingProgress);
  }

  /**
   * Создать панель отладки
   * @returns {DebugPanel}
   */
  createDebugPanel() {
    const {
      debugInfo,
      debugState,
      debugTotal,
      debugCurrent,
      debugCache,
      debugMemory,
      debugListeners,
    } = this.dom.getMultiple(
      "debugInfo",
      "debugState",
      "debugTotal",
      "debugCurrent",
      "debugCache",
      "debugMemory",
      "debugListeners",
    );

    return new DebugPanel({
      container: debugInfo,
      state: debugState,
      total: debugTotal,
      current: debugCurrent,
      cache: debugCache,
      memory: debugMemory,
      listeners: debugListeners,
    });
  }

  /**
   * Создать контроллер событий
   * @param {Object} handlers - Обработчики событий
   * @param {Function} handlers.onFlip
   * @param {Function} handlers.onTOCClick
   * @param {Function} handlers.onOpen
   * @param {Function} handlers.onSettings
   * @param {Function} handlers.isBusy
   * @param {Function} handlers.isOpened
   * @returns {EventController}
   */
  createEventController(handlers) {
    return new EventController({
      book: this.dom.get("book"),
      eventManager: this.eventManager,
      ...handlers,
    });
  }
}
