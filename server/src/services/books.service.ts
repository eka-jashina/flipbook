import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
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

  // Get next position
  const lastBook = await prisma.book.findFirst({
    where: { userId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const nextPosition = (lastBook?.position ?? -1) + 1;

  const book = await prisma.book.create({
    data: {
      userId,
      title: data.title,
      author: data.author || '',
      position: nextPosition,
    },
  });

  // Create associated default records
  await Promise.all([
    prisma.bookAppearance.create({ data: { bookId: book.id } }),
    prisma.bookSounds.create({ data: { bookId: book.id } }),
    prisma.bookDefaultSettings.create({ data: { bookId: book.id } }),
  ]);

  return getBookById(book.id, userId);
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
 * Delete a book.
 */
export async function deleteBook(
  bookId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true },
  });

  if (!book) throw new AppError(404, 'Book not found');
  if (book.userId !== userId) throw new AppError(403, 'Access denied');

  await prisma.book.delete({ where: { id: bookId } });
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

  // Update positions in a transaction
  await prisma.$transaction(
    bookIds.map((id, index) =>
      prisma.book.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );
}
