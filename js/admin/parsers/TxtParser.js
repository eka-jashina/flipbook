/**
 * TxtParser
 *
 * Парсер TXT-файлов.
 * Разбивает текст на абзацы по пустым строкам.
 */

import { escapeHtml } from './parserUtils.js';

/**
 * Парсинг TXT файла
 * @param {File} file
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseTxt(file) {
  const text = await file.text();
  const title = file.name.replace(/\.txt$/i, '');

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
