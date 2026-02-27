import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import { logger } from '../utils/logger.js';
import {
  mapAppearanceToDto,
  mapSoundsToDto,
  mapDefaultSettingsToDto,
  mapAmbientToDto,
  mapChapterToListItem,
  mapDecorativeFontToDto,
} from '../utils/mappers.js';
import type { BookListItem, BookDetail } from '../types/api.js';

export interface PaginatedBooks {
  books: BookListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get books for a user with pagination (for bookshelf display).
 */
export async function getUserBooks(
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedBooks> {
  const prisma = getPrisma();
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      skip: offset,
      take: limit,
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
    }),
    prisma.book.count({ where: { userId } }),
  ]);

  return {
    books: books.map((book) => ({
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
    })),
    total,
    limit,
    offset,
  };
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

  // Ownership verified by requireBookOwnership middleware
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
    chapters: book.chapters.map(mapChapterToListItem),
    defaultSettings: book.defaultSettings
      ? mapDefaultSettingsToDto(book.defaultSettings)
      : null,
    appearance: book.appearance
      ? mapAppearanceToDto(book.appearance)
      : null,
    sounds: book.sounds
      ? mapSoundsToDto(book.sounds)
      : null,
    ambients: book.ambients.map(mapAmbientToDto),
    decorativeFont: book.decorativeFont
      ? mapDecorativeFontToDto(book.decorativeFont)
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

  // Ownership verified by requireBookOwnership middleware
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
  // Ownership verified by requireBookOwnership middleware

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
    const results = await Promise.allSettled(urls.map((u) => deleteFileByUrl(u)));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        logger.warn({ bookId, url: urls[i], error: String(result.reason) }, 'Failed to delete S3 file during book cleanup');
      }
    });
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
