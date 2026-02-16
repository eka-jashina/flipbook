/**
 * TxtParser
 *
 * Парсер TXT-файлов.
 * Разбивает текст на абзацы по пустым строкам.
 */

import { escapeHtml } from './parserUtils.js';

/**
 * Парсинг TXT файла
 * @param {ArrayBuffer} buffer - Содержимое файла
 * @param {string} fileName - Имя файла
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseTxt(buffer, fileName) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const title = fileName.replace(/\.txt$/i, '');

  if (!text.trim()) {
    throw new Error('Файл пуст');
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
