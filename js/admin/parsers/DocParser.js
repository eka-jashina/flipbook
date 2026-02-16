/**
 * DocParser
 *
 * Парсер DOC-файлов (бинарный формат Microsoft Word).
 * Базовое извлечение текста из OLE2 Compound Document.
 */

import { escapeHtml } from './parserUtils.js';

/**
 * Парсинг DOC файла
 * @param {ArrayBuffer} buffer - Содержимое файла
 * @param {string} fileName - Имя файла
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseDoc(buffer, fileName) {
  const title = fileName.replace(/\.doc$/i, '');
  const text = extractDocText(buffer);

  if (!text.trim()) {
    throw new Error('Не удалось извлечь текст из DOC');
  }

  // Разделить на абзацы по пустым строкам
  const paragraphs = text.split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const html = paragraphs
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return {
    title,
    author: '',
    chapters: [{
      id: 'chapter_1',
      title,
      html: `<article>\n<h2>${escapeHtml(title)}</h2>\n${html}\n</article>`,
    }],
  };
}

// --- Извлечение текста ---

/**
 * Извлечь текст из бинарного DOC (OLE2 Compound Document)
 * Базовая реализация: ищет текстовый поток в бинарных данных
 */
export function extractDocText(buffer) {
  const bytes = new Uint8Array(buffer);

  // Попробовать извлечь Unicode (UTF-16LE) текст
  // DOC хранит текст как последовательность символов в WordDocument stream
  const chunks = [];
  let current = '';
  let consecutivePrintable = 0;

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);

    // Печатные символы Unicode + переносы строк
    if ((code >= 0x20 && code <= 0xFFFF && code !== 0xFFFE && code !== 0xFFFF) ||
        code === 0x0A || code === 0x0D || code === 0x09) {
      const char = String.fromCharCode(code);
      current += char;
      consecutivePrintable++;
    } else {
      // Сохранить блок, если он достаточно длинный (>20 символов)
      if (consecutivePrintable > 20) {
        chunks.push(current);
      }
      current = '';
      consecutivePrintable = 0;
    }
  }

  if (consecutivePrintable > 20) {
    chunks.push(current);
  }

  if (chunks.length === 0) {
    // Fallback: попробовать как ASCII
    return extractDocTextAscii(bytes);
  }

  // Взять самый длинный блок (обычно это основной текст)
  let text = chunks.sort((a, b) => b.length - a.length)[0] || '';

  // Очистить управляющие символы, оставив переносы
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Нормализовать переносы строк
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return text;
}

/**
 * Fallback: извлечь ASCII-текст из DOC
 */
export function extractDocTextAscii(bytes) {
  const chunks = [];
  let current = '';
  let consecutivePrintable = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 0x20 && b <= 0x7E) || b === 0x0A || b === 0x0D || b === 0x09) {
      current += String.fromCharCode(b);
      consecutivePrintable++;
    } else {
      if (consecutivePrintable > 30) {
        chunks.push(current);
      }
      current = '';
      consecutivePrintable = 0;
    }
  }

  if (consecutivePrintable > 30) {
    chunks.push(current);
  }

  const text = chunks.sort((a, b) => b.length - a.length)[0] || '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
