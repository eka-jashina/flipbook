/**
 * Общие утилиты для серверных парсеров книг.
 * Используют jsdom вместо браузерного DOMParser.
 */

import { JSDOM } from 'jsdom';

/**
 * Экранирование HTML
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Парсинг XML-строки
 */
export function parseXml(xmlString: string): Document {
  const dom = new JSDOM(xmlString, { contentType: 'application/xml' });
  const doc = dom.window.document;

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Попробовать как text/html если XML-парсинг не удался
    const htmlDom = new JSDOM(xmlString, { contentType: 'text/html' });
    return htmlDom.window.document;
  }

  return doc;
}

/**
 * Парсинг HTML-строки
 */
export function parseHtml(htmlString: string): Document {
  const dom = new JSDOM(htmlString, { contentType: 'text/html' });
  return dom.window.document;
}

/**
 * Получить текстовое содержимое элемента по селектору
 */
export function getTextContent(doc: Document, selector: string): string {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() || '';
}

/** Результат парсинга книги */
export interface ParsedBook {
  title: string;
  author: string;
  chapters: ParsedChapter[];
}

/** Глава книги */
export interface ParsedChapter {
  id: string;
  title: string;
  html: string;
}
