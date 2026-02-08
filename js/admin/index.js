/**
 * Точка входа админ-панели
 */
import { AdminConfigStore } from './AdminConfigStore.js';
import { ChaptersModule } from './modules/ChaptersModule.js';
import { SettingsModule } from './modules/SettingsModule.js';
import { SoundsModule } from './modules/SoundsModule.js';
import { AmbientsModule } from './modules/AmbientsModule.js';
import { AppearanceModule } from './modules/AppearanceModule.js';
import { FontsModule } from './modules/FontsModule.js';
import { ExportModule } from './modules/ExportModule.js';

class AdminApp {
  constructor(store) {
    this.store = store;
    this._toastTimer = null;

    // Инициализация модулей
    this.chapters = new ChaptersModule(this);
    this.settings = new SettingsModule(this);
    this.sounds = new SoundsModule(this);
    this.ambients = new AmbientsModule(this);
    this.appearance = new AppearanceModule(this);
    this.fonts = new FontsModule(this);
    this.export = new ExportModule(this);

    this._modules = [
      this.chapters, this.settings, this.sounds,
      this.ambients, this.appearance, this.fonts, this.export,
    ];

    this._cacheDOM();
    this._bindEvents();
    this._render();
  }

  // --- DOM ---

  _cacheDOM() {
    // Табы (общая навигация)
    this.tabs = document.querySelectorAll('.admin-tab');
    this.panels = document.querySelectorAll('.admin-panel');

    // Toast
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');

    // DOM для модулей
    this._modules.forEach(m => m.cacheDOM());
  }

  // --- Привязка событий ---

  _bindEvents() {
    // Табы
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // События модулей
    this._modules.forEach(m => m.bindEvents());
  }

  // --- Рендер ---

  _render() {
    this._modules.forEach(m => m.render());
  }

  _renderJsonPreview() {
    this.export.renderJsonPreview();
  }

  // --- Табы ---

  _switchTab(tabName) {
    this.tabs.forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });

    this.panels.forEach(p => {
      const isActive = p.dataset.panel === tabName;
      p.classList.toggle('active', isActive);
      p.hidden = !isActive;
    });

    if (tabName === 'export') {
      this._renderJsonPreview();
    }
  }

  // --- Утилиты ---

  _showToast(message) {
    this.toastMessage.textContent = message;
    this.toast.hidden = false;

    requestAnimationFrame(() => {
      this.toast.classList.add('visible');
    });

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.classList.remove('visible');
      setTimeout(() => { this.toast.hidden = true; }, 300);
    }, 2500);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Запуск (асинхронная инициализация из-за IndexedDB)
AdminConfigStore.create().then(store => new AdminApp(store));
