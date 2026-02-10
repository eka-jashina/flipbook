/**
 * HTML SANITIZER
 * Защита от XSS при загрузке внешнего HTML-контента.
 *
 * Особенности:
 * - Белый список разрешённых тегов и атрибутов
 * - Удаление опасных тегов (script, style, iframe и др.)
 * - Фильтрация event-handler атрибутов (onclick, onerror и др.)
 * - Блокировка опасных URL-схем (javascript:, data: и др.)
 * - Настраиваемые списки через options
 */

export class HTMLSanitizer {
  /**
   * @param {Object} options - Опции настройки
   * @param {string[]} options.allowedTags - Разрешённые HTML-теги
   * @param {string[]} options.allowedAttrsGlobal - Глобально разрешённые атрибуты
   * @param {Object} options.allowedAttrsByTag - Атрибуты, разрешённые для конкретных тегов
   * @param {string[]} options.allowedDataAttrs - Разрешённые data-* атрибуты
   */
  constructor(options = {}) {
    /** @type {Set<string>} Белый список тегов */
    this.ALLOWED_TAGS = new Set(options.allowedTags || [
      "article", "section", "div", "span", "main", "aside",
      "header", "footer", "nav", "p", "h1", "h2", "h3", "h4",
      "h5", "h6", "strong", "em", "b", "i", "u", "s", "mark",
      "small", "sub", "sup", "ol", "ul", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code", "br", "hr", "figure",
      "figcaption", "img", "a", "table", "thead", "tbody", "tfoot",
      "tr", "th", "td", "caption",
    ]);

    /** @type {Set<string>} Глобально разрешённые атрибуты */
    this.ALLOWED_ATTRS_GLOBAL = new Set(
      options.allowedAttrsGlobal || ["class", "id", "title", "lang", "dir"]
    );

    /** @type {Object<string, string[]>} Атрибуты, разрешённые для конкретных тегов */
    this.ALLOWED_ATTRS_BY_TAG = options.allowedAttrsByTag || {
      img: ["src", "alt", "width", "height", "loading"],
      a: ["href", "rel", "target"],
      ol: ["start", "type", "reversed"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    };

    /** @type {Set<string>} Разрешённые data-* атрибуты */
    this.ALLOWED_DATA_ATTRS = new Set(
      options.allowedDataAttrs || ["data-chapter", "data-chapter-start", "data-index"]
    );

    /** @type {Set<string>} Чёрный список опасных тегов */
    this.DANGEROUS_TAGS = new Set([
      "script", "style", "link", "meta", "base", "object", "embed",
      "applet", "iframe", "frame", "frameset", "form", "input",
      "button", "select", "textarea", "template", "slot", "portal",
    ]);

    /** @type {RegExp} Паттерн опасных URL-схем */
    this.DANGEROUS_URL_SCHEMES = /^(?:javascript|vbscript|data|blob):/i;
  }

  /**
   * Очистить HTML от потенциально опасного содержимого
   * @param {string} html - Исходный HTML
   * @returns {string} Безопасный HTML
   */
  sanitize(html) {
    if (!html || typeof html !== "string") return "";

    let doc;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");

      // Проверяем на ошибку парсинга (DOMParser возвращает документ с parsererror)
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        console.warn("HTMLSanitizer: parser error detected, returning empty string");
        return "";
      }
    } catch (error) {
      console.error("HTMLSanitizer: failed to parse HTML", error);
      return "";
    }

    this._sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }

  /**
   * Рекурсивно обработать дочерние узлы
   * @private
   * @param {Node} node - Родительский узел
   */
  _sanitizeNode(node) {
    if (!node) return;
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this._sanitizeElement(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        // Удаляем HTML-комментарии (могут содержать условные конструкции IE)
        child.remove();
      }
    }
  }

  /**
   * Обработать отдельный элемент
   * @private
   * @param {Element} el - DOM-элемент
   */
  _sanitizeElement(el) {
    const tagName = el.tagName.toLowerCase();

    // Удаляем запрещённые теги полностью
    if (this.DANGEROUS_TAGS.has(tagName) || !this.ALLOWED_TAGS.has(tagName)) {
      el.remove();
      return;
    }

    this._sanitizeAttributes(el, tagName);
    this._sanitizeNode(el);
  }

  /**
   * Очистить атрибуты элемента
   * @private
   * @param {Element} el - DOM-элемент
   * @param {string} tagName - Имя тега в нижнем регистре
   */
  _sanitizeAttributes(el, tagName) {
    const attrsToRemove = [];

    for (const attr of el.attributes) {
      const attrName = attr.name.toLowerCase();

      // Удаляем все event handlers (onclick, onerror и т.д.)
      if (attrName.startsWith("on")) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Проверяем глобально разрешённые атрибуты
      if (this.ALLOWED_ATTRS_GLOBAL.has(attrName)) continue;
      // Проверяем разрешённые data-* атрибуты
      if (attrName.startsWith("data-") && this.ALLOWED_DATA_ATTRS.has(attrName)) continue;

      // Проверяем атрибуты, специфичные для тега
      const tagAttrs = this.ALLOWED_ATTRS_BY_TAG[tagName];
      if (tagAttrs && tagAttrs.includes(attrName)) continue;

      attrsToRemove.push(attr.name);
    }

    for (const attrName of attrsToRemove) {
      el.removeAttribute(attrName);
    }

    // Дополнительная проверка URL-атрибутов на опасные схемы.
    // Разрешаем data:image/ для безопасных растровых форматов — они используются
    // для встроенных изображений из EPUB/FB2. SVG не разрешаем (может содержать скрипты).
    if (el.hasAttribute("src")) {
      const srcValue = el.getAttribute("src");
      if (this.DANGEROUS_URL_SCHEMES.test(srcValue) && !this._isSafeImageDataUrl(srcValue)) {
        el.removeAttribute("src");
      }
    }

    if (el.hasAttribute("href")) {
      const href = el.getAttribute("href");

      // Удаляем опасные URL-схемы
      if (this.DANGEROUS_URL_SCHEMES.test(href)) {
        el.removeAttribute("href");
      } else if (this._isExternalUrl(href)) {
        // Для внешних ссылок добавляем защитные атрибуты
        el.setAttribute("rel", "noopener noreferrer");
        el.setAttribute("target", "_blank");
      }
    }
  }

  /**
   * Проверить, является ли data: URL безопасным изображением (растровый формат).
   * SVG не считается безопасным, т.к. может содержать <script>.
   * @private
   * @param {string} url - URL для проверки
   * @returns {boolean} true если это безопасный растровый data:image/ URL
   */
  _isSafeImageDataUrl(url) {
    if (!url) return false;
    return /^data:image\/(?:png|jpe?g|gif|webp|bmp|tiff?|ico|avif);base64,/i.test(url);
  }

  /**
   * Проверить, является ли URL внешним
   * @private
   * @param {string} url - URL для проверки
   * @returns {boolean} true если URL внешний
   */
  _isExternalUrl(url) {
    if (!url) return false;
    // Относительные пути и якоря — не внешние
    if (url.startsWith("/") || url.startsWith("#") || url.startsWith("./") || url.startsWith("../")) {
      return false;
    }
    // Абсолютные URL с протоколом — внешние
    return /^https?:\/\//i.test(url);
  }
}

export const sanitizer = new HTMLSanitizer();
