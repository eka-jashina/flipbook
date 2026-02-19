/**
 * Базовый модуль админ-панели
 * Предоставляет доступ к store, DOM-элементам и утилитам
 */
export class BaseModule {
  constructor(app) {
    this.app = app;
    this.store = app.store;
  }

  _showToast(message) {
    this.app._showToast(message);
  }

  _escapeHtml(str) {
    return this.app._escapeHtml(str);
  }

  _renderJsonPreview() {
    this.app._renderJsonPreview();
  }

  /**
   * Проверить файл перед загрузкой: размер, MIME-тип или расширение.
   * При ошибке показывает toast и очищает inputEl (если передан).
   * @param {File} file
   * @param {Object} opts
   * @param {number}   [opts.maxSize]    - Максимальный размер в байтах
   * @param {string}   [opts.mimePrefix] - Требуемый MIME-префикс ('image/', 'audio/' …)
   * @param {string[]} [opts.extensions] - Допустимые расширения (['.woff2', '.ttf'] …)
   * @param {HTMLInputElement} [opts.inputEl] - Input для сброса при ошибке
   * @returns {boolean}
   */
  _validateFile(file, { maxSize, mimePrefix, extensions, inputEl } = {}) {
    if (maxSize !== undefined && file.size > maxSize) {
      const mb = maxSize / (1024 * 1024);
      this._showToast(`Файл слишком большой (макс. ${mb} МБ)`);
      if (inputEl) inputEl.value = '';
      return false;
    }

    if (mimePrefix && !file.type.startsWith(mimePrefix)) {
      const labels = { 'image/': 'изображения', 'audio/': 'аудиофайлы' };
      this._showToast(`Допустимы только ${labels[mimePrefix] ?? mimePrefix}`);
      if (inputEl) inputEl.value = '';
      return false;
    }

    if (extensions) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!extensions.includes(ext)) {
        this._showToast(`Допустимые форматы: ${extensions.join(', ')}`);
        if (inputEl) inputEl.value = '';
        return false;
      }
    }

    return true;
  }

  /**
   * Загрузить кастомный шрифт через FontFace API для предпросмотра в админке
   */
  _loadCustomFontPreview(familyName, dataUrl) {
    for (const face of document.fonts) {
      if (face.family === familyName) {
        document.fonts.delete(face);
      }
    }

    const fontFace = new FontFace(familyName, `url(${dataUrl})`);
    fontFace.load().then((loaded) => {
      document.fonts.add(loaded);
    }).catch(() => {
      this._showToast('Ошибка загрузки шрифта');
    });
  }
}
