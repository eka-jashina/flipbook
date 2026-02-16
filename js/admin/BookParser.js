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
   * @param {File} file - Загруженный файл
   * @returns {Promise<ParsedBook>}
   */
  static async parse(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    switch (ext) {
      case '.epub': return parseEpub(file);
      case '.fb2':  return parseFb2(file);
      case '.txt':  return parseTxt(file);
      case '.docx': return parseDocx(file);
      case '.doc':  return parseDoc(file);
      default:
        throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
    }
  }
}
