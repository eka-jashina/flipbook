/**
 * BookParser
 *
 * Фасад для парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 *
 * Каждая глава преобразуется в HTML-формат, совместимый с ридером:
 * <article><h2>Заголовок</h2><p>Текст...</p></article>
 *
 * После парсинга HTML каждой главы проходит через DOMPurify-санитизацию
 * для защиты от XSS при загрузке недоверенных файлов.
 */

import { parseEpub } from './parsers/EpubParser.js';
import { parseFb2 } from './parsers/Fb2Parser.js';
import { parseTxt } from './parsers/TxtParser.js';
import { parseDocx } from './parsers/DocxParser.js';
import { parseDoc } from './parsers/DocParser.js';
import { HTMLSanitizer } from '../utils/HTMLSanitizer.js';

/** Ленивая инициализация санитайзера (один экземпляр на модуль) */
let _sanitizer = null;
function getSanitizer() {
  if (!_sanitizer) {
    _sanitizer = new HTMLSanitizer();
  }
  return _sanitizer;
}

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

/**
 * Санитизировать HTML глав после парсинга (защита от XSS).
 * @param {ParsedBook} result
 * @returns {ParsedBook}
 */
function sanitizeParsedBook(result) {
  const sanitizer = getSanitizer();
  for (const chapter of result.chapters) {
    if (chapter.html) {
      chapter.html = sanitizer.sanitize(chapter.html);
    }
  }
  return result;
}

export class BookParser {
  /**
   * Определить формат файла и распарсить
   * @param {File} file - Загруженный файл
   * @returns {Promise<ParsedBook>}
   */
  static async parse(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    let result;
    switch (ext) {
      case '.epub': result = await parseEpub(file); break;
      case '.fb2':  result = await parseFb2(file); break;
      case '.txt':  result = await parseTxt(file); break;
      case '.docx': result = await parseDocx(file); break;
      case '.doc':  result = await parseDoc(file); break;
      default:
        throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
    }

    return sanitizeParsedBook(result);
  }
}
