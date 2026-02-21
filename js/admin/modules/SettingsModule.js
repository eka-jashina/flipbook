/**
 * Модуль настроек по умолчанию и видимости настроек
 */
import { BaseModule } from './BaseModule.js';

/** Конфигурация переключателей видимости */
const VISIBILITY_TOGGLES = [
  { key: 'fontSize', label: 'Размер шрифта' },
  { key: 'theme', label: 'Тема' },
  { key: 'font', label: 'Шрифт' },
  { key: 'fullscreen', label: 'Полноэкранный режим' },
  { key: 'sound', label: 'Звук перелистывания' },
  { key: 'ambient', label: 'Атмосфера' },
];

export class SettingsModule extends BaseModule {
  cacheDOM() {
    this.defaultFont = document.getElementById('defaultFont');
    this.defaultFontSize = document.getElementById('defaultFontSize');
    this.fontSizeValue = document.getElementById('fontSizeValue');
    this.defaultThemeBtns = document.querySelectorAll('#defaultTheme .setting-theme-btn');
    this.defaultSound = document.getElementById('defaultSound');
    this.soundLabel = document.getElementById('soundLabel');
    this.defaultVolume = document.getElementById('defaultVolume');
    this.volumeValue = document.getElementById('volumeValue');
    this.defaultAmbientGroup = document.getElementById('defaultAmbient');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');

    // Видимость настроек — контейнер + генерация переключателей
    this.visibilityToggles = document.getElementById('visibilityToggles');
    this._renderVisibilityTogglesHTML();
  }

  bindEvents() {
    this.defaultFontSize.addEventListener('input', () => {
      this.fontSizeValue.textContent = `${this.defaultFontSize.value}px`;
    });

    this.defaultSound.addEventListener('change', () => {
      this.soundLabel.textContent = this.defaultSound.checked ? 'Включён' : 'Выключен';
    });

    this.defaultVolume.addEventListener('input', () => {
      this.volumeValue.textContent = `${this.defaultVolume.value}%`;
    });

    this.defaultThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.defaultThemeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    this.defaultAmbientGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.setting-ambient-btn');
      if (!btn) return;
      this.defaultAmbientGroup.querySelectorAll('.setting-ambient-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    this.saveSettingsBtn.addEventListener('click', () => this._saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this._resetSettings());

    // Видимость настроек
    this.visibilityToggles.addEventListener('change', (e) => {
      const input = e.target.closest('[data-visibility]');
      if (!input) return;
      this.store.updateSettingsVisibility({ [input.dataset.visibility]: input.checked });
      this._renderJsonPreview();
      this._showToast(input.checked ? 'Настройка показана' : 'Настройка скрыта');
    });
  }

  render() {
    this._renderSettings();
    this._renderSettingsVisibility();
  }

  _renderSettings() {
    const s = this.store.getDefaultSettings();

    this.defaultFont.value = s.font;
    this.defaultFontSize.value = s.fontSize;
    this.fontSizeValue.textContent = `${s.fontSize}px`;

    this.defaultThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === s.theme);
    });

    this.defaultSound.checked = s.soundEnabled;
    this.soundLabel.textContent = s.soundEnabled ? 'Включён' : 'Выключен';
    this.defaultVolume.value = Math.round(s.soundVolume * 100);
    this.volumeValue.textContent = `${Math.round(s.soundVolume * 100)}%`;

    // Динамически заполнить кнопки амбиентов (только видимые)
    const ambients = this.store.getAmbients().filter(a => a.visible);
    this.defaultAmbientGroup.innerHTML = ambients.map(a =>
      `<button class="setting-ambient-btn${a.id === s.ambientType ? ' active' : ''}" type="button" data-ambient="${this._escapeHtml(a.id)}">${this._escapeHtml(a.icon)} ${this._escapeHtml(a.shortLabel || a.label)}</button>`
    ).join('');
  }

  /** Сгенерировать HTML переключателей видимости из конфигурации */
  _renderVisibilityTogglesHTML() {
    this.visibilityToggles.innerHTML = VISIBILITY_TOGGLES.map(({ key, label }) => `
      <div class="visibility-toggle-row">
        <span class="visibility-toggle-label">${label}</span>
        <label class="admin-toggle"><input type="checkbox" data-visibility="${key}" checked><span class="admin-toggle-slider"></span></label>
      </div>
    `).join('');
  }

  _renderSettingsVisibility() {
    const v = this.store.getSettingsVisibility();
    const inputs = this.visibilityToggles.querySelectorAll('[data-visibility]');
    inputs.forEach(input => {
      const key = input.dataset.visibility;
      if (key in v) {
        input.checked = v[key];
      }
    });
  }

  _saveSettings() {
    const activeTheme = document.querySelector('#defaultTheme .setting-theme-btn.active');
    const activeAmbient = document.querySelector('#defaultAmbient .setting-ambient-btn.active');

    this.store.updateDefaultSettings({
      font: this.defaultFont.value,
      fontSize: parseInt(this.defaultFontSize.value, 10),
      theme: activeTheme ? activeTheme.dataset.theme : 'light',
      soundEnabled: this.defaultSound.checked,
      soundVolume: parseInt(this.defaultVolume.value, 10) / 100,
      ambientType: activeAmbient ? activeAmbient.dataset.ambient : 'none',
    });

    this._renderJsonPreview();
    this._showToast('Настройки сохранены');
  }

  _resetSettings() {
    this.store.updateDefaultSettings({
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    this.store.updateSettingsVisibility({
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: true,
      ambient: true,
    });

    this._renderSettings();
    this._renderSettingsVisibility();
    this._renderJsonPreview();
    this._showToast('Настройки сброшены');
  }

  /** Обновить select шрифтов в настройках по умолчанию */
  updateFontSelect() {
    const fonts = this.store.getReadingFonts().filter(f => f.enabled);
    const current = this.defaultFont.value;
    this.defaultFont.innerHTML = fonts.map(f =>
      `<option value="${this._escapeHtml(f.id)}">${this._escapeHtml(f.label)}</option>`
    ).join('');

    const hasCurrentFont = fonts.some(f => f.id === current);
    if (hasCurrentFont) {
      this.defaultFont.value = current;
    } else if (fonts.length > 0) {
      this.defaultFont.value = fonts[0].id;
    }
  }
}
