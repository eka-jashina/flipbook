import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  mapAppearanceToDto,
  mapSoundsToDto,
  mapDefaultSettingsToDto,
  mapAmbientToDto,
  mapChapterToListItem,
  mapDecorativeFontToDto,
} from '../utils/mappers.js';
import type {
  PublicAuthor,
  PublicBookCard,
  PublicShelf,
  PublicBookDetail,
  DiscoverResult,
} from '../types/api.js';

/**
 * Map a User record to a public author object (no email or sensitive fields).
 */
function toPublicAuthor(user: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}): PublicAuthor {
  return {
    username: user.username!,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
}

/**
 * Get an author's public shelf: profile + published books.
 */
export async function getShelf(username: string): Promise<PublicShelf> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      books: {
        where: { visibility: 'published' },
        orderBy: { position: 'asc' },
        take: 200,
        include: {
          _count: { select: { chapters: true } },
          appearance: {
            select: {
              lightCoverBgStart: true,
              lightCoverBgEnd: true,
              lightCoverText: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'Author not found');
  }

  return {
    author: toPublicAuthor(user),
    books: user.books.map((book): PublicBookCard => ({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      publishedAt: book.publishedAt?.toISOString() ?? null,
      chaptersCount: book._count.chapters,
      appearance: book.appearance
        ? {
            light: {
              coverBgStart: book.appearance.lightCoverBgStart,
              coverBgEnd: book.appearance.lightCoverBgEnd,
              coverText: book.appearance.lightCoverText,
            },
          }
        : null,
    })),
  };
}

/**
 * Get full details of a public book (published or unlisted).
 */
export async function getPublicBook(bookId: string): Promise<PublicBookDetail> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      user: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
        },
      },
      chapters: { orderBy: { position: 'asc' } },
      appearance: true,
      sounds: true,
      ambients: { orderBy: { position: 'asc' } },
      decorativeFont: true,
      defaultSettings: true,
    },
  });

  if (!book || book.visibility === 'draft') {
    throw new AppError(404, 'Book not found');
  }

  if (!book.user.username) {
    throw new AppError(404, 'Book not found');
  }

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    publishedAt: book.publishedAt?.toISOString() ?? null,
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
    owner: toPublicAuthor(book.user),
  };
}

/**
 * Get chapters for a public book (metadata only, no content).
 */
export async function getPublicChapters(bookId: string) {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { visibility: true },
  });

  if (!book || book.visibility === 'draft') {
    throw new AppError(404, 'Book not found');
  }

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: 'asc' },
  });

  return chapters.map(mapChapterToListItem);
}

/**
 * Get chapter content for a public book.
 */
export async function getPublicChapterContent(
  bookId: string,
  chapterId: string,
): Promise<string | null> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { visibility: true },
  });

  if (!book || book.visibility === 'draft') {
    throw new AppError(404, 'Book not found');
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true, htmlContent: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return chapter.htmlContent;
}

/**
 * Discover public books with pagination (newest first).
 */
export async function discoverBooks(
  options: { limit?: number; offset?: number } = {},
): Promise<DiscoverResult> {
  const prisma = getPrisma();
  const limit = Math.min(options.limit ?? 20, 50);
  const offset = options.offset ?? 0;

  const [books, total] = await Promise.all([
    prisma.book.findMany({
      where: { visibility: 'published' },
      orderBy: { publishedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        _count: { select: { chapters: true } },
        user: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
        appearance: {
          select: {
            lightCoverBgStart: true,
            lightCoverBgEnd: true,
            lightCoverText: true,
          },
        },
      },
    }),
    prisma.book.count({ where: { visibility: 'published' } }),
  ]);

  return {
    books: books
      .filter((b) => b.user.username !== null)
      .map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description,
        publishedAt: book.publishedAt?.toISOString() ?? null,
        chaptersCount: book._count.chapters,
        appearance: book.appearance
          ? {
              light: {
                coverBgStart: book.appearance.lightCoverBgStart,
                coverBgEnd: book.appearance.lightCoverBgEnd,
                coverText: book.appearance.lightCoverText,
              },
            }
          : null,
        owner: toPublicAuthor(book.user),
      })),
    total,
    limit,
    offset,
  };
}
