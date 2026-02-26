import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import type { BookListItem, BookDetail } from '../types/api.js';

/**
 * Get all books for a user (for bookshelf display).
 */
export async function getUserBooks(userId: string): Promise<BookListItem[]> {
  const prisma = getPrisma();

  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { chapters: true } },
      appearance: {
        select: {
          lightCoverBgStart: true,
          lightCoverBgEnd: true,
          lightCoverText: true,
        },
      },
      readingProgress: {
        where: { userId },
        select: { page: true, updatedAt: true },
        take: 1,
      },
    },
  });

  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    position: book.position,
    chaptersCount: book._count.chapters,
    coverBgMode: book.coverBgMode,
    appearance: book.appearance
      ? {
          light: {
            coverBgStart: book.appearance.lightCoverBgStart,
            coverBgEnd: book.appearance.lightCoverBgEnd,
            coverText: book.appearance.lightCoverText,
          },
        }
      : null,
    readingProgress:
      book.readingProgress.length > 0
        ? {
            page: book.readingProgress[0].page,
            updatedAt: book.readingProgress[0].updatedAt.toISOString(),
          }
        : null,
  }));
}

/**
 * Get full book details by ID.
 */
export async function getBookById(
  bookId: string,
  userId: string,
): Promise<BookDetail> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: {
        orderBy: { position: 'asc' },
      },
      appearance: true,
      sounds: true,
      ambients: {
        orderBy: { position: 'asc' },
      },
      decorativeFont: true,
      defaultSettings: true,
    },
  });

  if (!book) {
    throw new AppError(404, 'Book not found');
  }

  if (book.userId !== userId) {
    throw new AppError(403, 'Access denied');
  }

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover: {
      bg: book.coverBg,
      bgMobile: book.coverBgMobile,
      bgMode: book.coverBgMode,
      bgCustomUrl: book.coverBgCustomUrl,
    },
    chapters: book.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      position: ch.position,
      filePath: ch.filePath,
      hasHtmlContent: ch.htmlContent !== null,
      bg: ch.bg,
      bgMobile: ch.bgMobile,
    })),
    defaultSettings: book.defaultSettings
      ? {
          font: book.defaultSettings.font,
          fontSize: book.defaultSettings.fontSize,
          theme: book.defaultSettings.theme,
          soundEnabled: book.defaultSettings.soundEnabled,
          soundVolume: book.defaultSettings.soundVolume,
          ambientType: book.defaultSettings.ambientType,
          ambientVolume: book.defaultSettings.ambientVolume,
        }
      : null,
    appearance: book.appearance
      ? {
          fontMin: book.appearance.fontMin,
          fontMax: book.appearance.fontMax,
          light: {
            coverBgStart: book.appearance.lightCoverBgStart,
            coverBgEnd: book.appearance.lightCoverBgEnd,
            coverText: book.appearance.lightCoverText,
            coverBgImageUrl: book.appearance.lightCoverBgImageUrl,
            pageTexture: book.appearance.lightPageTexture,
            customTextureUrl: book.appearance.lightCustomTextureUrl,
            bgPage: book.appearance.lightBgPage,
            bgApp: book.appearance.lightBgApp,
          },
          dark: {
            coverBgStart: book.appearance.darkCoverBgStart,
            coverBgEnd: book.appearance.darkCoverBgEnd,
            coverText: book.appearance.darkCoverText,
            coverBgImageUrl: book.appearance.darkCoverBgImageUrl,
            pageTexture: book.appearance.darkPageTexture,
            customTextureUrl: book.appearance.darkCustomTextureUrl,
            bgPage: book.appearance.darkBgPage,
            bgApp: book.appearance.darkBgApp,
          },
        }
      : null,
    sounds: book.sounds
      ? {
          pageFlip: book.sounds.pageFlipUrl,
          bookOpen: book.sounds.bookOpenUrl,
          bookClose: book.sounds.bookCloseUrl,
        }
      : null,
    ambients: book.ambients.map((a) => ({
      id: a.id,
      ambientKey: a.ambientKey,
      label: a.label,
      shortLabel: a.shortLabel,
      icon: a.icon,
      fileUrl: a.fileUrl,
      visible: a.visible,
      builtin: a.builtin,
      position: a.position,
    })),
    decorativeFont: book.decorativeFont
      ? {
          name: book.decorativeFont.name,
          fileUrl: book.decorativeFont.fileUrl,
        }
      : null,
  };
}

/**
 * Create a new book for a user.
 */
export async function createBook(
  userId: string,
  data: { title: string; author?: string },
): Promise<BookDetail> {
  const prisma = getPrisma();

  // Check resource limit (outside transaction for fast-fail)
  const count = await prisma.book.count({ where: { userId } });
  if (count >= RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
    throw new AppError(403, `Book limit reached (max ${RESOURCE_LIMITS.MAX_BOOKS_PER_USER})`);
  }

  const bookId = await withSerializableRetry(prisma, async (tx) => {
    const lastBook = await tx.book.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = (lastBook?.position ?? -1) + 1;

    const book = await tx.book.create({
      data: {
        userId,
        title: data.title,
        author: data.author || '',
        position: nextPosition,
      },
    });

    await Promise.all([
      tx.bookAppearance.create({ data: { bookId: book.id } }),
      tx.bookSounds.create({ data: { bookId: book.id } }),
      tx.bookDefaultSettings.create({ data: { bookId: book.id } }),
    ]);

    return book.id;
  });

  return getBookById(bookId, userId);
}

/**
 * Update a book's metadata.
 */
export async function updateBook(
  bookId: string,
  userId: string,
  data: {
    title?: string;
    author?: string;
    coverBgMode?: string;
    coverBgCustomUrl?: string | null;
  },
): Promise<BookDetail> {
  const prisma = getPrisma();

  // Check ownership
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true },
  });

  if (!book) throw new AppError(404, 'Book not found');
  if (book.userId !== userId) throw new AppError(403, 'Access denied');

  await prisma.book.update({
    where: { id: bookId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.author !== undefined && { author: data.author }),
      ...(data.coverBgMode !== undefined && { coverBgMode: data.coverBgMode }),
      ...(data.coverBgCustomUrl !== undefined && {
        coverBgCustomUrl: data.coverBgCustomUrl,
      }),
    },
  });

  return getBookById(bookId, userId);
}

/**
 * Delete a book and clean up associated S3 files (best-effort).
 */
export async function deleteBook(
  bookId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      ambients: { select: { fileUrl: true } },
      sounds: { select: { pageFlipUrl: true, bookOpenUrl: true, bookCloseUrl: true } },
      decorativeFont: { select: { fileUrl: true } },
      appearance: { select: { lightCoverBgImageUrl: true, darkCoverBgImageUrl: true, lightCustomTextureUrl: true, darkCustomTextureUrl: true } },
    },
  });

  if (!book) throw new AppError(404, 'Book not found');
  if (book.userId !== userId) throw new AppError(403, 'Access denied');

  // Collect all S3 file URLs before deletion
  const urls: string[] = [];
  book.ambients?.forEach((a) => { if (a.fileUrl) urls.push(a.fileUrl); });
  if (book.sounds) {
    [book.sounds.pageFlipUrl, book.sounds.bookOpenUrl, book.sounds.bookCloseUrl]
      .forEach((u) => { if (u && !u.startsWith('sounds/')) urls.push(u); });
  }
  if (book.decorativeFont?.fileUrl) urls.push(book.decorativeFont.fileUrl);
  if (book.appearance) {
    [book.appearance.lightCoverBgImageUrl, book.appearance.darkCoverBgImageUrl,
     book.appearance.lightCustomTextureUrl, book.appearance.darkCustomTextureUrl]
      .filter(Boolean).forEach((u) => urls.push(u!));
  }

  await prisma.book.delete({ where: { id: bookId } });

  // Best-effort S3 cleanup after successful DB deletion
  if (urls.length > 0) {
    const { deleteFileByUrl } = await import('../utils/storage.js');
    await Promise.allSettled(urls.map((u) => deleteFileByUrl(u)));
  }
}

/**
 * Reorder books for a user.
 */
export async function reorderBooks(
  userId: string,
  bookIds: string[],
): Promise<void> {
  const prisma = getPrisma();

  // Verify all books belong to the user
  const books = await prisma.book.findMany({
    where: { userId, id: { in: bookIds } },
    select: { id: true },
  });

  if (books.length !== bookIds.length) {
    throw new AppError(400, 'Some book IDs are invalid');
  }

  await bulkUpdatePositions(prisma, 'books', bookIds);
}
