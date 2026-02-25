/**
 * TxtParser
 *
 * Парсер TXT-файлов.
 * Разбивает текст на абзацы по пустым строкам.
 */

import { escapeHtml, type ParsedBook } from './parserUtils.js';

/**
 * Парсинг TXT из Buffer
 */
export function parseTxt(buffer: Buffer, filename: string): ParsedBook {
  const text = buffer.toString('utf-8');
  const title = filename.replace(/\.txt$/i, '');

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
