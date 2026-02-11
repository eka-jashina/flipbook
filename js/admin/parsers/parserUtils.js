/**
 * Общие утилиты для парсеров книг
 */

/**
 * Экранирование HTML
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Парсинг XML-строки
 * @param {string} xmlString
 * @returns {Document}
 */
export function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Попробовать как text/html если XML-парсинг не удался
    return parser.parseFromString(xmlString, 'text/html');
  }

  return doc;
}

/**
 * Парсинг HTML-строки
 * @param {string} htmlString
 * @returns {Document}
 */
export function parseHtml(htmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
}

/**
 * Получить текстовое содержимое элемента по селектору
 * @param {Document} doc
 * @param {string} selector
 * @returns {string}
 */
export function getTextContent(doc, selector) {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() || '';
}
