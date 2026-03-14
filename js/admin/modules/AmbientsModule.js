/**
 * Модуль управления атмосферными звуками (амбиентами)
 */
import { BaseModule } from './BaseModule.js';
import { readFileAsDataURL } from './adminHelpers.js';
import { t } from '@i18n';

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

  async render() {
    await this._renderAmbients();
  }

  async _renderAmbients() {
    const ambients = await this.store.getAmbients();

    this.ambientCards.innerHTML = ambients.map((a, i) => {
      const isNone = a.id === 'none';
      const isUploaded = a.file && (a.file.startsWith('data:') || a.file.startsWith('http'));
      const meta = a.file
        ? this._escapeHtml(isUploaded ? t('admin.ambients.uploadedFile') : a.file)
        : t('admin.ambients.noFile');

      return `
        <div class="ambient-card${a.visible ? '' : ' hidden-ambient'}" data-index="${i}">
          <div class="ambient-card-icon">${this._escapeHtml(a.icon)}</div>
          <div class="ambient-card-info">
            <div class="ambient-card-label">${this._escapeHtml(a.label)}</div>
            <div class="ambient-card-meta">${meta}</div>
          </div>
          <div class="ambient-card-actions">
            ${!isNone ? `
              <label class="admin-toggle" title="${a.visible ? t('admin.ambients.hide') : t('admin.ambients.show')}">
                <input type="checkbox" data-ambient-toggle="${i}" ${a.visible ? 'checked' : ''}>
                <span class="admin-toggle-slider"></span>
              </label>
            ` : ''}
            ${!a.builtin ? `
              <button class="chapter-action-btn" data-ambient-edit="${i}" title="${t('common.edit')}">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="chapter-action-btn delete" data-ambient-delete="${i}" title="${t('common.delete')}">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Делегирование событий
    this.ambientCards.onclick = async (e) => {
      const toggle = e.target.closest('[data-ambient-toggle]');
      if (toggle) {
        const idx = parseInt(toggle.dataset.ambientToggle, 10);
        await this.store.updateAmbient(idx, { visible: toggle.checked });
        await this._renderAmbients();
        await this.app.settings.render();
        this._renderJsonPreview();
        this._showToast(toggle.checked ? t('admin.ambients.shown') : t('admin.ambients.hidden'));
        return;
      }

      const editBtn = e.target.closest('[data-ambient-edit]');
      if (editBtn) {
        this._openAmbientModal(parseInt(editBtn.dataset.ambientEdit, 10));
        return;
      }

      const deleteBtn = e.target.closest('[data-ambient-delete]');
      if (deleteBtn) {
        this._confirm(t('admin.ambients.deleteConfirm')).then(async (ok) => {
          if (!ok) return;
          await this.store.removeAmbient(parseInt(deleteBtn.dataset.ambientDelete, 10));
          await this._renderAmbients();
          await this.app.settings.render();
          this._renderJsonPreview();
          this._showToast(t('admin.ambients.deleted'));
        });
      }
    };
  }

  async _openAmbientModal(editIndex = null) {
    this._editingAmbientIndex = editIndex;
    this._pendingAmbientDataUrl = null;
    this.ambientUploadLabel.textContent = t('admin.ambients.selectFile');

    if (editIndex !== null) {
      const ambients = await this.store.getAmbients();
      const a = ambients[editIndex];
      this.ambientModalTitle.textContent = t('admin.ambients.editTitle');
      this.ambientLabelInput.value = a.label;
      this.ambientIconInput.value = a.icon;
      const isUploadedFile = a.file && (a.file.startsWith('data:') || a.file.startsWith('http'));
      this.ambientFileInput.value = isUploadedFile ? '' : (a.file || '');
      if (isUploadedFile) {
        this._pendingAmbientDataUrl = a.file;
        this.ambientUploadLabel.textContent = t('admin.ambients.fileLoaded');
      }
    } else {
      this.ambientModalTitle.textContent = t('admin.ambients.addTitle');
      this.ambientForm.reset();
    }

    this.ambientModal.showModal();
  }

  async _handleAmbientFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

    const uploadedUrl = await this.store.uploadSound(file);
    if (uploadedUrl) {
      this._pendingAmbientDataUrl = uploadedUrl;
    } else {
      this._pendingAmbientDataUrl = await readFileAsDataURL(file);
    }
    this.ambientUploadLabel.textContent = file.name;
    e.target.value = '';
  }

  async _handleAmbientSubmit(e) {
    e.preventDefault();

    const label = this.ambientLabelInput.value.trim();
    const icon = this.ambientIconInput.value.trim();
    const filePath = this.ambientFileInput.value.trim();

    if (!label || !icon) return;

    const file = this._pendingAmbientDataUrl || filePath || null;
    if (!file) {
      this._showToast(t('admin.ambients.validationRequired'));
      return;
    }

    let id;
    if (this._editingAmbientIndex !== null) {
      const ambients = await this.store.getAmbients();
      id = ambients[this._editingAmbientIndex].id;
    } else {
      id = `custom_${Date.now()}`;
    }

    const shortLabel = label.length > 8 ? label.slice(0, 8) : label;

    const ambient = { id, label, shortLabel, icon, file, visible: true, builtin: false };

    if (this._editingAmbientIndex !== null) {
      this.store.updateAmbient(this._editingAmbientIndex, ambient);
      this._showToast(t('admin.ambients.updated'));
    } else {
      this.store.addAmbient(ambient);
      this._showToast(t('admin.ambients.added'));
    }

    this.ambientModal.close();
    this._renderAmbients();
    this.app.settings.render();
    this._renderJsonPreview();
  }
}
