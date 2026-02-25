/**
 * BookParser
 *
 * Фасад для серверных парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 */

import { parseTxt } from './TxtParser.js';
import { parseDoc } from './DocParser.js';
import { parseDocx } from './DocxParser.js';
import { parseEpub } from './EpubParser.js';
import { parseFb2 } from './Fb2Parser.js';
import type { ParsedBook } from './parserUtils.js';

export type { ParsedBook, ParsedChapter } from './parserUtils.js';

/**
 * Определить формат файла и распарсить
 */
export async function parseBook(buffer: Buffer, filename: string): Promise<ParsedBook> {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  switch (ext) {
    case '.epub': return parseEpub(buffer, filename);
    case '.fb2':  return parseFb2(buffer, filename);
    case '.txt':  return parseTxt(buffer, filename);
    case '.docx': return parseDocx(buffer, filename);
    case '.doc':  return parseDoc(buffer, filename);
    default:
      throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub, .fb2, .docx, .doc, .txt`);
  }
}
