/**
 * BookParser
 *
 * Фасад для парсеров электронных книг (EPUB, FB2, DOCX, DOC, TXT).
 * Определяет формат файла и делегирует парсинг соответствующему модулю.
 *
 * Каждая глава преобразуется в HTML-формат, совместимый с ридером:
 * <article><h2>Заголовок</h2><p>Текст...</p></article>
 */

import JSZip from 'jszip';
import { parseEpub } from './parsers/EpubParser.js';
import { parseFb2 } from './parsers/Fb2Parser.js';
import { parseTxt } from './parsers/TxtParser.js';
import { parseDocx } from './parsers/DocxParser.js';
import { parseDoc } from './parsers/DocParser.js';

const SUPPORTED_EXTENSIONS = new Set(['.epub', '.fb2', '.txt', '.docx', '.doc']);

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
   * @param {string} [mimeType] - MIME-тип от провайдера (Android content://)
   * @returns {Promise<ParsedBook>}
   */
  static async parse(buffer, fileName = 'book', mimeType = '') {
    const ext = await detectExtension(buffer, fileName, mimeType);
    const normalizedName = withExtension(fileName, ext);

    switch (ext) {
      case '.epub': return parseEpub(buffer, normalizedName);
      case '.fb2': return parseFb2(buffer, normalizedName);
      case '.txt': return parseTxt(buffer, normalizedName);
      case '.docx': return parseDocx(buffer, normalizedName);
      case '.doc': return parseDoc(buffer, normalizedName);
      default:
        throw new Error('Неподдерживаемый формат. Допустимы .epub, .fb2, .docx, .doc, .txt');
    }
  }
}

function getExtension(fileName = '') {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.substring(dotIndex).toLowerCase();
}

function withExtension(fileName = '', ext) {
  if (!fileName) return `book${ext}`;
  return getExtension(fileName) ? fileName : `${fileName}${ext}`;
}

async function detectExtension(buffer, fileName = '', mimeType = '') {
  const byName = getExtension(fileName);
  if (SUPPORTED_EXTENSIONS.has(byName)) {
    return byName;
  }

  const byMime = extensionFromMime(mimeType);
  if (byMime) {
    return byMime;
  }

  if (isOleDoc(buffer)) {
    return '.doc';
  }

  if (isZipBuffer(buffer)) {
    const zipExt = await extensionFromZip(buffer);
    if (zipExt) {
      return zipExt;
    }
  }

  if (looksLikeFb2(buffer)) {
    return '.fb2';
  }

  if (looksLikeText(buffer)) {
    return '.txt';
  }

  throw new Error('Неподдерживаемый формат. Допустимы .epub, .fb2, .docx, .doc, .txt');
}

function extensionFromMime(mimeType = '') {
  const normalized = mimeType.toLowerCase();
  const map = {
    'application/epub+zip': '.epub',
    'application/x-fictionbook+xml': '.fb2',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
  };

  return map[normalized] || '';
}

function isZipBuffer(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4B
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

function isOleDoc(buffer) {
  if (buffer.byteLength < 8) return false;
  const bytes = new Uint8Array(buffer, 0, 8);
  const signature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  return signature.every((byte, index) => bytes[index] === byte);
}

async function extensionFromZip(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);

    if (entries.some((name) => name === 'mimetype')) {
      const mimetype = await zip.file('mimetype')?.async('string');
      if (mimetype?.trim() === 'application/epub+zip') {
        return '.epub';
      }
    }

    if (entries.some((name) => name.endsWith('container.xml')) && entries.some((name) => name.endsWith('.opf'))) {
      return '.epub';
    }

    if (entries.some((name) => name.toLowerCase() === 'word/document.xml')) {
      return '.docx';
    }
  } catch {
    return '';
  }

  return '';
}

function looksLikeFb2(buffer) {
  const text = decodeTextHead(buffer).toLowerCase();
  return text.includes('<fictionbook') || text.includes('<fiction-book');
}

function looksLikeText(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
  if (!bytes.length) return false;

  let printable = 0;
  for (const byte of bytes) {
    if (byte === 0x09 || byte === 0x0A || byte === 0x0D || (byte >= 0x20 && byte <= 0x7E)) {
      printable++;
    }
  }

  return printable / bytes.length > 0.8;
}

function decodeTextHead(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
