/**
 * Модуль управления атмосферными звуками (амбиентами)
 */
import { BaseModule } from './BaseModule.js';

export class AmbientsModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editingAmbientIndex = null;
    this._pendingAmbientDataUrl = null;
  }

  cacheDOM() {
    this.ambientCards = document.getElementById('ambientCards');
    this.addAmbientBtn = document.getElementById('addAmbient');
    this.ambientModal = document.getElementById('ambientModal');
    this.ambientModalTitle = document.getElementById('ambientModalTitle');
    this.ambientForm = document.getElementById('ambientForm');
    this.cancelAmbientModal = document.getElementById('cancelAmbientModal');
    this.ambientLabelInput = document.getElementById('ambientLabel');
    this.ambientIconInput = document.getElementById('ambientIcon');
    this.ambientFileInput = document.getElementById('ambientFile');
    this.ambientFileUpload = document.getElementById('ambientFileUpload');
    this.ambientUploadLabel = document.getElementById('ambientUploadLabel');
  }

  bindEvents() {
    this.addAmbientBtn.addEventListener('click', () => this._openAmbientModal());
    this.cancelAmbientModal.addEventListener('click', () => this.ambientModal.close());
    this.ambientForm.addEventListener('submit', (e) => this._handleAmbientSubmit(e));
    this.ambientFileUpload.addEventListener('change', (e) => this._handleAmbientFileUpload(e));
  }

  render() {
    this._renderAmbients();
  }

  _renderAmbients() {
    const ambients = this.store.getAmbients();

    this.ambientCards.innerHTML = ambients.map((a, i) => {
      const isNone = a.id === 'none';
      const meta = a.file
        ? this._escapeHtml(a.file.startsWith('data:') ? 'Загруженный файл' : a.file)
        : 'Нет файла';

      return `
        <div class="ambient-card${a.visible ? '' : ' hidden-ambient'}" data-index="${i}">
          <div class="ambient-card-icon">${this._escapeHtml(a.icon)}</div>
          <div class="ambient-card-info">
            <div class="ambient-card-label">${this._escapeHtml(a.label)}</div>
            <div class="ambient-card-meta">${meta}</div>
          </div>
          <div class="ambient-card-actions">
            ${!isNone ? `
              <label class="admin-toggle" title="${a.visible ? 'Скрыть' : 'Показать'}">
                <input type="checkbox" data-ambient-toggle="${i}" ${a.visible ? 'checked' : ''}>
                <span class="admin-toggle-slider"></span>
              </label>
            ` : ''}
            ${!a.builtin ? `
              <button class="chapter-action-btn" data-ambient-edit="${i}" title="Редактировать">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="chapter-action-btn delete" data-ambient-delete="${i}" title="Удалить">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Делегирование событий
    this.ambientCards.onclick = (e) => {
      const toggle = e.target.closest('[data-ambient-toggle]');
      if (toggle) {
        const idx = parseInt(toggle.dataset.ambientToggle, 10);
        this.store.updateAmbient(idx, { visible: toggle.checked });
        this._renderAmbients();
        this.app.settings.render();
        this._renderJsonPreview();
        this._showToast(toggle.checked ? 'Атмосфера показана' : 'Атмосфера скрыта');
        return;
      }

      const editBtn = e.target.closest('[data-ambient-edit]');
      if (editBtn) {
        this._openAmbientModal(parseInt(editBtn.dataset.ambientEdit, 10));
        return;
      }

      const deleteBtn = e.target.closest('[data-ambient-delete]');
      if (deleteBtn) {
        this._confirm('Удалить эту атмосферу?').then((ok) => {
          if (!ok) return;
          this.store.removeAmbient(parseInt(deleteBtn.dataset.ambientDelete, 10));
          this._renderAmbients();
          this.app.settings.render();
          this._renderJsonPreview();
          this._showToast('Атмосфера удалена');
        });
      }
    };
  }

  _openAmbientModal(editIndex = null) {
    this._editingAmbientIndex = editIndex;
    this._pendingAmbientDataUrl = null;
    this.ambientUploadLabel.textContent = 'Выбрать файл';

    if (editIndex !== null) {
      const a = this.store.getAmbients()[editIndex];
      this.ambientModalTitle.textContent = 'Редактировать атмосферу';
      this.ambientLabelInput.value = a.label;
      this.ambientIconInput.value = a.icon;
      this.ambientFileInput.value = a.file && !a.file.startsWith('data:') ? a.file : '';
      if (a.file && a.file.startsWith('data:')) {
        this._pendingAmbientDataUrl = a.file;
        this.ambientUploadLabel.textContent = 'Файл загружен';
      }
    } else {
      this.ambientModalTitle.textContent = 'Добавить атмосферу';
      this.ambientForm.reset();
    }

    this.ambientModal.showModal();
  }

  _handleAmbientFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 5 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

    const reader = new FileReader();
    reader.onload = () => {
      this._pendingAmbientDataUrl = reader.result;
      this.ambientUploadLabel.textContent = file.name;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  _handleAmbientSubmit(e) {
    e.preventDefault();

    const label = this.ambientLabelInput.value.trim();
    const icon = this.ambientIconInput.value.trim();
    const filePath = this.ambientFileInput.value.trim();

    if (!label || !icon) return;

    const file = this._pendingAmbientDataUrl || filePath || null;
    if (!file) {
      this._showToast('Укажите путь к файлу или загрузите аудио');
      return;
    }

    const id = this._editingAmbientIndex !== null
      ? this.store.getAmbients()[this._editingAmbientIndex].id
      : `custom_${Date.now()}`;

    const shortLabel = label.length > 8 ? label.slice(0, 8) : label;

    const ambient = { id, label, shortLabel, icon, file, visible: true, builtin: false };

    if (this._editingAmbientIndex !== null) {
      this.store.updateAmbient(this._editingAmbientIndex, ambient);
      this._showToast('Атмосфера обновлена');
    } else {
      this.store.addAmbient(ambient);
      this._showToast('Атмосфера добавлена');
    }

    this.ambientModal.close();
    this._renderAmbients();
    this.app.settings.render();
    this._renderJsonPreview();
  }
}
