/**
 * HTML SANITIZER
 * Защита от XSS при загрузке внешнего HTML-контента.
 */

export class HTMLSanitizer {
  constructor(options = {}) {
    this.ALLOWED_TAGS = new Set(options.allowedTags || [
      "article", "section", "div", "span", "main", "aside",
      "header", "footer", "nav", "p", "h1", "h2", "h3", "h4",
      "h5", "h6", "strong", "em", "b", "i", "u", "s", "mark",
      "small", "sub", "sup", "ol", "ul", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code", "br", "hr", "figure",
      "figcaption", "img", "table", "thead", "tbody", "tfoot",
      "tr", "th", "td", "caption",
    ]);

    this.ALLOWED_ATTRS_GLOBAL = new Set(
      options.allowedAttrsGlobal || ["class", "id", "title", "lang", "dir"]
    );

    this.ALLOWED_ATTRS_BY_TAG = options.allowedAttrsByTag || {
      img: ["src", "alt", "width", "height", "loading"],
      a: ["href", "rel", "target"],
      ol: ["start", "type", "reversed"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    };

    this.ALLOWED_DATA_ATTRS = new Set(
      options.allowedDataAttrs || ["data-chapter", "data-chapter-start", "data-index"]
    );

    this.DANGEROUS_TAGS = new Set([
      "script", "style", "link", "meta", "base", "object", "embed",
      "applet", "iframe", "frame", "frameset", "form", "input",
      "button", "select", "textarea", "template", "slot", "portal",
    ]);

    this.DANGEROUS_URL_SCHEMES = /^(?:javascript|vbscript|data|blob):/i;
  }

  sanitize(html) {
    if (!html || typeof html !== "string") return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    this._sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }

  _sanitizeNode(node) {
    if (!node) return;
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this._sanitizeElement(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    }
  }

  _sanitizeElement(el) {
    const tagName = el.tagName.toLowerCase();

    if (this.DANGEROUS_TAGS.has(tagName) || !this.ALLOWED_TAGS.has(tagName)) {
      el.remove();
      return;
    }

    this._sanitizeAttributes(el, tagName);
    this._sanitizeNode(el);
  }

  _sanitizeAttributes(el, tagName) {
    const attrsToRemove = [];

    for (const attr of el.attributes) {
      const attrName = attr.name.toLowerCase();

      if (attrName.startsWith("on")) {
        attrsToRemove.push(attr.name);
        continue;
      }

      if (this.ALLOWED_ATTRS_GLOBAL.has(attrName)) continue;
      if (attrName.startsWith("data-") && this.ALLOWED_DATA_ATTRS.has(attrName)) continue;

      const tagAttrs = this.ALLOWED_ATTRS_BY_TAG[tagName];
      if (tagAttrs && tagAttrs.includes(attrName)) continue;

      attrsToRemove.push(attr.name);
    }

    for (const attrName of attrsToRemove) {
      el.removeAttribute(attrName);
    }

    if (el.hasAttribute("src") && this.DANGEROUS_URL_SCHEMES.test(el.getAttribute("src"))) {
      el.removeAttribute("src");
    }

    if (el.hasAttribute("href") && this.DANGEROUS_URL_SCHEMES.test(el.getAttribute("href"))) {
      el.removeAttribute("href");
    }
  }
}

export const sanitizer = new HTMLSanitizer();
