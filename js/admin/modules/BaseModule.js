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
