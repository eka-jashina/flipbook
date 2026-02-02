/**
 * CORE SERVICES
 * Группирует базовые инфраструктурные зависимости.
 *
 * Содержит:
 * - DOMManager - кэширование DOM элементов
 * - EventListenerManager - управление слушателями событий
 * - TimerManager - управление таймерами с debounce
 * - StorageManager - абстракция localStorage
 */

import { DOMManager } from '../DOMManager.js';
import {
  EventListenerManager,
  TimerManager,
  StorageManager
} from '../../utils/index.js';
import { CONFIG } from '../../config.js';

export class CoreServices {
  constructor() {
    this.dom = new DOMManager();
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.storage = new StorageManager(CONFIG.STORAGE_KEY);
  }

  /**
   * Очистить все ресурсы
   */
  destroy() {
    this.eventManager.clear();
    this.timerManager.clear();
    this.dom.clearPages();

    this.dom = null;
    this.eventManager = null;
    this.timerManager = null;
    this.storage = null;
  }
}
