/**
 * Модуль экспорта/импорта конфигурации
 */
import { BaseModule } from './BaseModule.js';

export class ExportModule extends BaseModule {
  cacheDOM() {
    this.exportBtn = document.getElementById('exportConfig');
    this.importInput = document.getElementById('importConfig');
    this.resetAllBtn = document.getElementById('resetAll');
    this.jsonPreview = document.getElementById('jsonPreview');
    this.copyJsonBtn = document.getElementById('copyJson');
  }

  bindEvents() {
    this.exportBtn.addEventListener('click', () => this._exportConfig());
    this.importInput.addEventListener('change', (e) => this._importConfig(e));
    this.resetAllBtn.addEventListener('click', () => this._resetAll());
    this.copyJsonBtn.addEventListener('click', () => this._copyJson());
  }

  render() {
    this.renderJsonPreview();
  }

  renderJsonPreview() {
    this.jsonPreview.textContent = this.store.exportJSON();
  }

  _exportConfig() {
    const json = this.store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'flipbook-config.json';
    a.click();

    URL.revokeObjectURL(url);
    this._showToast('Конфигурация скачана');
  }

  _importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importJSON(reader.result);
        this.app._render();
        this._showToast('Конфигурация загружена');
      } catch {
        this._showToast('Ошибка: неверный формат JSON');
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  }

  _resetAll() {
    if (confirm('Сбросить все настройки админки? Ридер вернётся к конфигурации по умолчанию.')) {
      this.store.clear();
      this.app._render();
      this._showToast('Всё сброшено');
    }
  }

  _copyJson() {
    navigator.clipboard.writeText(this.store.exportJSON()).then(() => {
      this._showToast('Скопировано в буфер');
    });
  }
}
