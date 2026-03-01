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

/** Reusable filter: only non-deleted books for a given user */
const activeBooks = (userId: string) => ({ userId, deletedAt: null });

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
  const where = activeBooks(userId);

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where,
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
    prisma.book.count({ where }),
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

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
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

  // Check resource limit — only count active books (outside transaction for fast-fail)
  const count = await prisma.book.count({ where: activeBooks(userId) });
  if (count >= RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
    throw new AppError(403, `Book limit reached (max ${RESOURCE_LIMITS.MAX_BOOKS_PER_USER})`);
  }

  const bookId = await withSerializableRetry(prisma, async (tx) => {
    const lastBook = await tx.book.findFirst({
      where: activeBooks(userId),
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
 * Supports optimistic locking via optional `ifUnmodifiedSince` timestamp.
 */
export async function updateBook(
  bookId: string,
  userId: string,
  data: {
    title?: string;
    author?: string;
    coverBgMode?: string;
    coverBgCustomUrl?: string | null;
    ifUnmodifiedSince?: string;
  },
): Promise<BookDetail> {
  const prisma = getPrisma();

  // Optimistic locking: reject if resource was modified after the given timestamp
  if (data.ifUnmodifiedSince) {
    const book = await prisma.book.findFirst({
      where: { id: bookId, deletedAt: null },
      select: { updatedAt: true },
    });
    if (!book) throw new AppError(404, 'Book not found');

    const clientDate = new Date(data.ifUnmodifiedSince);
    if (book.updatedAt > clientDate) {
      throw new AppError(409, 'Book was modified by another request', 'CONFLICT_DETECTED');
    }
  }

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
 * Soft-delete a book and clean up associated S3 files (best-effort).
 * The book is marked as deleted but retained in the database for potential recovery.
 */
export async function deleteBook(
  bookId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrisma();

  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    include: {
      ambients: { select: { fileUrl: true } },
      sounds: { select: { pageFlipUrl: true, bookOpenUrl: true, bookCloseUrl: true } },
      decorativeFont: { select: { fileUrl: true } },
      appearance: { select: { lightCoverBgImageUrl: true, darkCoverBgImageUrl: true, lightCustomTextureUrl: true, darkCustomTextureUrl: true } },
    },
  });

  if (!book) throw new AppError(404, 'Book not found');
  // Ownership verified by requireBookOwnership middleware

  // Soft-delete: set deletedAt instead of removing the row
  await prisma.book.update({
    where: { id: bookId },
    data: { deletedAt: new Date() },
  });

  // Best-effort S3 cleanup.
  // Only include URLs that are actual S3 uploads (extractKeyFromUrl returns
  // null for relative/built-in paths like "sounds/page-flip.mp3").
  const { deleteFileByUrl, extractKeyFromUrl } = await import('../utils/storage.js');

  const allUrls: (string | null | undefined)[] = [];
  book.ambients?.forEach((a) => allUrls.push(a.fileUrl));
  if (book.sounds) {
    allUrls.push(book.sounds.pageFlipUrl, book.sounds.bookOpenUrl, book.sounds.bookCloseUrl);
  }
  if (book.decorativeFont) allUrls.push(book.decorativeFont.fileUrl);
  if (book.appearance) {
    allUrls.push(
      book.appearance.lightCoverBgImageUrl, book.appearance.darkCoverBgImageUrl,
      book.appearance.lightCustomTextureUrl, book.appearance.darkCustomTextureUrl,
    );
  }

  const s3Urls = allUrls.filter((u): u is string => !!u && extractKeyFromUrl(u) !== null);

  // Best-effort S3 cleanup after successful soft-delete.
  // Failed deletions are logged as orphaned files for manual cleanup.
  if (s3Urls.length > 0) {
    const results = await Promise.allSettled(s3Urls.map((u) => deleteFileByUrl(u)));
    const orphanedUrls: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        orphanedUrls.push(s3Urls[i]);
      }
    });
    if (orphanedUrls.length > 0) {
      logger.warn(
        { bookId, orphanedUrls, total: s3Urls.length, failed: orphanedUrls.length },
        'Orphaned S3 files after book deletion — manual cleanup may be needed',
      );
    }
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

  // Verify all books belong to the user and are not deleted
  const books = await prisma.book.findMany({
    where: { ...activeBooks(userId), id: { in: bookIds } },
    select: { id: true },
  });

  if (books.length !== bookIds.length) {
    throw new AppError(400, 'Some book IDs are invalid');
  }

  await bulkUpdatePositions(prisma, 'books', bookIds);
}
