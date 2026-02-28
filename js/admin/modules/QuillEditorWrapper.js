/**
 * Обёртка Quill WYSIWYG редактора для модального окна главы
 * Инкапсулирует инициализацию, конфигурацию и lifecycle Quill.
 *
 * Quill загружается лениво (dynamic import) при первом вызове init()
 * для сокращения начальной загрузки админ-панели (~150 КБ).
 */

/** Максимальный размер изображения для вставки (5 МБ) */
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

/** Кешированный конструктор Quill (загружается один раз) */
let _QuillCtor = null;

export class QuillEditorWrapper {
  constructor() {
    /** @type {Object|null} Quill instance */
    this._quill = null;
    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Инициализировать Quill в указанном контейнере.
   * При первом вызове загружает Quill через dynamic import.
   * @param {HTMLElement} container - DOM-элемент для редактора
   */
  async init(container) {
    this._container = container;

    if (this._quill) {
      this.destroy();
    }

    // Ленивая загрузка Quill (один раз, далее из кеша)
    if (!_QuillCtor) {
      const [{ default: Quill }] = await Promise.all([
        import('quill'),
        import('quill/dist/quill.snow.css'),
      ]);
      _QuillCtor = Quill;
    }

    this._quill = new _QuillCtor(container, {
      theme: 'snow',
      placeholder: 'Начните писать текст главы...',
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, 4, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean'],
          ],
          handlers: {
            image: () => this._handleImageInsert(),
          },
        },
      },
    });
  }

  /**
   * Загрузить HTML-контент в редактор
   * @param {string} html
   */
  setHTML(html) {
    if (!this._quill) return;
    const delta = this._quill.clipboard.convert({ html });
    this._quill.setContents(delta);
  }

  /**
   * Получить HTML из редактора
   * @returns {string}
   */
  getHTML() {
    if (!this._quill) return '';
    return this._quill.getSemanticHTML();
  }

  /**
   * Проверить, пуст ли редактор
   * @returns {boolean}
   */
  isEmpty() {
    if (!this._quill) return true;
    return this._quill.getText().trim().length === 0;
  }

  /** Очистить содержимое */
  clear() {
    if (!this._quill) return;
    this._quill.setText('');
  }

  /** Уничтожить экземпляр */
  destroy() {
    if (this._quill) {
      if (this._container) {
        this._container.innerHTML = '';
      }
      this._quill = null;
    }
  }

  /** @returns {boolean} */
  get isInitialized() {
    return this._quill !== null;
  }

  /**
   * Вставить изображение как base64 data URL
   * @private
   */
  _handleImageInsert() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file || file.size > IMAGE_MAX_SIZE) return;

      const reader = new FileReader();
      reader.onload = () => {
        const range = this._quill.getSelection(true);
        this._quill.insertEmbed(range.index, 'image', reader.result);
        this._quill.setSelection(range.index + 1);
      };
      reader.readAsDataURL(file);
    });

    input.click();
  }
}
