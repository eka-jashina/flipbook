import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import type { ChapterListItem, ChapterDetail } from '../types/api.js';

/**
 * Get all chapters for a book (metadata, no content).
 */
export async function getChapters(
  bookId: string,
  userId: string,
): Promise<ChapterListItem[]> {

  const prisma = getPrisma();
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: 'asc' },
  });

  return chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    position: ch.position,
    filePath: ch.filePath,
    hasHtmlContent: ch.htmlContent !== null,
    bg: ch.bg,
    bgMobile: ch.bgMobile,
  }));
}

/**
 * Get a single chapter with all details.
 */
export async function getChapterById(
  bookId: string,
  chapterId: string,
  userId: string,
): Promise<ChapterDetail> {

  const prisma = getPrisma();
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return {
    id: chapter.id,
    title: chapter.title,
    position: chapter.position,
    filePath: chapter.filePath,
    hasHtmlContent: chapter.htmlContent !== null,
    bg: chapter.bg,
    bgMobile: chapter.bgMobile,
    htmlContent: chapter.htmlContent,
  };
}

/**
 * Get just the HTML content of a chapter.
 */
export async function getChapterContent(
  bookId: string,
  chapterId: string,
  userId: string,
): Promise<string | null> {

  const prisma = getPrisma();
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true, htmlContent: true, filePath: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return chapter.htmlContent;
}

/**
 * Create a new chapter in a book.
 */
export async function createChapter(
  bookId: string,
  userId: string,
  data: {
    title: string;
    htmlContent?: string;
    filePath?: string;
    bg?: string;
    bgMobile?: string;
  },
): Promise<ChapterDetail> {

  const prisma = getPrisma();

  // Check resource limit (outside transaction for fast-fail)
  const count = await prisma.chapter.count({ where: { bookId } });
  if (count >= RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK) {
    throw new AppError(403, `Chapter limit reached (max ${RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK})`);
  }

  const chapter = await withSerializableRetry(prisma, async (tx) => {
    const lastChapter = await tx.chapter.findFirst({
      where: { bookId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = (lastChapter?.position ?? -1) + 1;

    return tx.chapter.create({
      data: {
        bookId,
        title: data.title,
        position: nextPosition,
        htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : null,
        filePath: data.filePath || null,
        bg: data.bg || '',
        bgMobile: data.bgMobile || '',
      },
    });
  });

  return {
    id: chapter.id,
    title: chapter.title,
    position: chapter.position,
    filePath: chapter.filePath,
    hasHtmlContent: chapter.htmlContent !== null,
    bg: chapter.bg,
    bgMobile: chapter.bgMobile,
    htmlContent: chapter.htmlContent,
  };
}

/**
 * Update a chapter.
 */
export async function updateChapter(
  bookId: string,
  chapterId: string,
  userId: string,
  data: {
    title?: string;
    htmlContent?: string | null;
    filePath?: string | null;
    bg?: string;
    bgMobile?: string;
  },
): Promise<ChapterDetail> {

  const prisma = getPrisma();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.htmlContent !== undefined && { htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : data.htmlContent }),
      ...(data.filePath !== undefined && { filePath: data.filePath }),
      ...(data.bg !== undefined && { bg: data.bg }),
      ...(data.bgMobile !== undefined && { bgMobile: data.bgMobile }),
    },
  });

  return {
    id: updated.id,
    title: updated.title,
    position: updated.position,
    filePath: updated.filePath,
    hasHtmlContent: updated.htmlContent !== null,
    bg: updated.bg,
    bgMobile: updated.bgMobile,
    htmlContent: updated.htmlContent,
  };
}

/**
 * Delete a chapter.
 */
export async function deleteChapter(
  bookId: string,
  chapterId: string,
  userId: string,
): Promise<void> {

  const prisma = getPrisma();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  await prisma.chapter.delete({ where: { id: chapterId } });
}

/**
 * Reorder chapters in a book.
 */
export async function reorderChapters(
  bookId: string,
  userId: string,
  chapterIds: string[],
): Promise<void> {

  const prisma = getPrisma();

  // Verify all chapters belong to the book
  const chapters = await prisma.chapter.findMany({
    where: { bookId, id: { in: chapterIds } },
    select: { id: true },
  });

  if (chapters.length !== chapterIds.length) {
    throw new AppError(400, 'Some chapter IDs are invalid');
  }

  await bulkUpdatePositions(prisma, 'chapters', chapterIds);
}
