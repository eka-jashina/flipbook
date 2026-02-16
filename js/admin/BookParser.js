/**
 * BookParser
 *
 * Фасад для парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 *
 * Каждая глава преобразуется в HTML-формат, совместимый с ридером:
 * <article><h2>Заголовок</h2><p>Текст...</p></article>
 */

import { parseEpub } from './parsers/EpubParser.js';
import { parseFb2 } from './parsers/Fb2Parser.js';
import { parseTxt } from './parsers/TxtParser.js';
import { parseDocx } from './parsers/DocxParser.js';
import { parseDoc } from './parsers/DocParser.js';

/**
 * Результат парсинга книги
 * @typedef {Object} ParsedBook
 * @property {string} title - Заголовок книги
 * @property {string} author - Автор
 * @property {ParsedChapter[]} chapters - Массив глав
 */

/**
 * Глава книги
 * @typedef {Object} ParsedChapter
 * @property {string} id - Уникальный идентификатор
 * @property {string} title - Заголовок главы
 * @property {string} html - HTML-контент главы
 */

export class BookParser {
  /**
   * Определить формат файла и распарсить
   * @param {ArrayBuffer} buffer - Содержимое файла
   * @param {string} fileName - Имя файла (для определения формата)
   * @returns {Promise<ParsedBook>}
   */
  static async parse(buffer, fileName) {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    switch (ext) {
      case '.epub': return parseEpub(buffer, fileName);
      case '.fb2':  return parseFb2(buffer, fileName);
      case '.txt':  return parseTxt(buffer, fileName);
      case '.docx': return parseDocx(buffer, fileName);
      case '.doc':  return parseDoc(buffer, fileName);
      default:
        throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
    }
  }
}
