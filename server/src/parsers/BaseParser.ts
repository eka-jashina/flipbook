/**
 * BaseParser — общие утилиты для серверных парсеров книг.
 *
 * Извлекает дублированную логику из DocxParser, EpubParser и других:
 * - validateZipSize — защита от ZIP-бомб
 * - findZipFile — поиск файла в ZIP с fallback-стратегиями
 * - createChapter — стандартное создание объекта главы
 * - wrapChapterHtml — оборачивание контента в <article>
 * - titleFromFilename — извлечение заголовка из имени файла
 */

import { escapeHtml, type ParsedChapter } from './parserUtils.js';
import type JSZip from 'jszip';

/** Максимальный суммарный размер распакованных данных (100 MB) */
export const MAX_DECOMPRESSED_SIZE = 100 * 1024 * 1024;

/**
 * Проверить суммарный размер распакованных файлов в ZIP-архиве (защита от ZIP-бомб).
 */
export async function validateZipSize(zip: JSZip): Promise<void> {
  let totalSize = 0;
  for (const [, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryData = (entry as any)._data;
    if (entryData && entryData.uncompressedSize !== undefined && entryData.uncompressedSize !== null) {
      totalSize += entryData.uncompressedSize;
    }
    if (totalSize > MAX_DECOMPRESSED_SIZE) {
      throw new Error(
        `Распакованный размер архива превышает лимит (${Math.round(MAX_DECOMPRESSED_SIZE / 1024 / 1024)} МБ). ` +
        `Возможно, файл повреждён.`,
      );
    }
  }
}

/**
 * Поиск файла в ZIP-архиве с несколькими fallback-стратегиями:
 * 1. Точное совпадение
 * 2. URL-декодированный путь
 * 3. URL-кодированный путь
 * 4. Регистронезависимый поиск
 * 5. Декодированный + регистронезависимый
 */
export function findZipFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  // Убираем фрагмент (#section) и начальный слеш
  const noFragment = path.split('#')[0];
  const cleanPath = noFragment.startsWith('/') ? noFragment.substring(1) : noFragment;

  // 1. Точное совпадение
  let file = zip.file(cleanPath);
  if (file) return file;

  // 2. URL-декодированный путь
  try {
    const decoded = decodeURIComponent(cleanPath);
    if (decoded !== cleanPath) {
      file = zip.file(decoded);
      if (file) return file;
    }
  } catch { /* невалидный URI — пропускаем */ }

  // 3. URL-кодированный путь
  try {
    const encoded = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
    if (encoded !== cleanPath) {
      file = zip.file(encoded);
      if (file) return file;
    }
  } catch { /* */ }

  // 4. Регистронезависимый поиск
  const lowerPath = cleanPath.toLowerCase();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir && name.toLowerCase() === lowerPath) {
      return entry;
    }
  }

  // 5. Декодированный + регистронезависимый
  try {
    const decodedLower = decodeURIComponent(cleanPath).toLowerCase();
    if (decodedLower !== lowerPath) {
      for (const [name, entry] of Object.entries(zip.files)) {
        if (!entry.dir && name.toLowerCase() === decodedLower) {
          return entry;
        }
      }
    }
  } catch { /* */ }

  return null;
}

/**
 * Создать объект главы в стандартном формате.
 */
export function createChapter(index: number, title: string, html: string): ParsedChapter {
  return {
    id: `chapter_${index + 1}`,
    title,
    html,
  };
}

/**
 * Обернуть контент в стандартную HTML-структуру главы.
 */
export function wrapChapterHtml(title: string, content: string): string {
  return `<article>\n<h2>${escapeHtml(title)}</h2>\n${content}\n</article>`;
}

/**
 * Извлечь заголовок из имени файла (без расширения).
 */
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
