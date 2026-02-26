import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import {
  mapAppearanceToDto,
  mapSoundsToDto,
  mapDefaultSettingsToDto,
  mapAmbientToDto,
  mapChapterToListItem,
  mapDecorativeFontToDto,
} from '../utils/mappers.js';
import type { BookDetail, ReadingFontItem, GlobalSettingsDetail, ExportData } from '../types/api.js';

export async function exportUserConfig(userId: string): Promise<ExportData> {
  const prisma = getPrisma();
  const books = await prisma.book.findMany({
    where: { userId }, orderBy: { position: 'asc' },
    include: { chapters: { orderBy: { position: 'asc' } }, appearance: true, sounds: true, ambients: { orderBy: { position: 'asc' } }, decorativeFont: true, defaultSettings: true },
  });

  const bookDetails: BookDetail[] = books.map((book) => ({
    id: book.id, title: book.title, author: book.author,
    cover: { bg: book.coverBg, bgMobile: book.coverBgMobile, bgMode: book.coverBgMode, bgCustomUrl: book.coverBgCustomUrl },
    chapters: book.chapters.map(mapChapterToListItem),
    defaultSettings: book.defaultSettings ? mapDefaultSettingsToDto(book.defaultSettings) : null,
    appearance: book.appearance ? mapAppearanceToDto(book.appearance) : null,
    sounds: book.sounds ? mapSoundsToDto(book.sounds) : null,
    ambients: book.ambients.map(mapAmbientToDto),
    decorativeFont: book.decorativeFont ? mapDecorativeFontToDto(book.decorativeFont) : null,
  }));

  const fonts = await prisma.readingFont.findMany({ where: { userId }, orderBy: { position: 'asc' } });
  const readingFonts: ReadingFontItem[] = fonts.map((f) => ({ id: f.id, fontKey: f.fontKey, label: f.label, family: f.family, builtin: f.builtin, enabled: f.enabled, fileUrl: f.fileUrl, position: f.position }));

  const settings = await prisma.globalSettings.findUnique({ where: { userId } });
  const globalSettings: GlobalSettingsDetail | null = settings ? { fontMin: settings.fontMin, fontMax: settings.fontMax, settingsVisibility: { fontSize: settings.visFontSize, theme: settings.visTheme, font: settings.visFont, fullscreen: settings.visFullscreen, sound: settings.visSound, ambient: settings.visAmbient } } : null;

  return { books: bookDetails, readingFonts, globalSettings };
}

export async function importUserConfig(userId: string, data: ExportData): Promise<{ imported: { books: number; fonts: number } }> {
  const prisma = getPrisma();
  if (!data.books || !Array.isArray(data.books)) throw new AppError(400, 'Invalid import data: books array required');

  // Check resource limits before starting import
  const existingBooks = await prisma.book.count({ where: { userId } });
  if (existingBooks + data.books.length > RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
    throw new AppError(403, `Import would exceed book limit (max ${RESOURCE_LIMITS.MAX_BOOKS_PER_USER})`);
  }
  if (data.readingFonts?.length) {
    const existingFonts = await prisma.readingFont.count({ where: { userId } });
    if (existingFonts + data.readingFonts.length > RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
      throw new AppError(403, `Import would exceed font limit (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const bookData of data.books) {
      const book = await tx.book.create({
        data: { userId, title: bookData.title || '', author: bookData.author || '', coverBg: bookData.cover?.bg || '', coverBgMobile: bookData.cover?.bgMobile || '', coverBgMode: bookData.cover?.bgMode || 'default', coverBgCustomUrl: bookData.cover?.bgCustomUrl || null },
      });
      if (bookData.chapters?.length) {
        await tx.chapter.createMany({
          data: bookData.chapters.map((ch, i) => {
            // Sanitize htmlContent if present in import data (defense against stored XSS)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawHtml = (ch as any).htmlContent;
            return {
              bookId: book.id, title: ch.title || '', position: i,
              filePath: ch.filePath || null, bg: ch.bg || '', bgMobile: ch.bgMobile || '',
              htmlContent: typeof rawHtml === 'string' ? sanitizeHtml(rawHtml) : null,
            };
          }),
        });
      }
      if (bookData.appearance) {
        const a = bookData.appearance;
        await tx.bookAppearance.create({ data: { bookId: book.id, fontMin: a.fontMin ?? 14, fontMax: a.fontMax ?? 22, lightCoverBgStart: a.light?.coverBgStart ?? '#3a2d1f', lightCoverBgEnd: a.light?.coverBgEnd ?? '#2a2016', lightCoverText: a.light?.coverText ?? '#f2e9d8', lightCoverBgImageUrl: a.light?.coverBgImageUrl ?? null, lightPageTexture: a.light?.pageTexture ?? 'default', lightCustomTextureUrl: a.light?.customTextureUrl ?? null, lightBgPage: a.light?.bgPage ?? '#fdfcf8', lightBgApp: a.light?.bgApp ?? '#e6e3dc', darkCoverBgStart: a.dark?.coverBgStart ?? '#111111', darkCoverBgEnd: a.dark?.coverBgEnd ?? '#000000', darkCoverText: a.dark?.coverText ?? '#eaeaea', darkCoverBgImageUrl: a.dark?.coverBgImageUrl ?? null, darkPageTexture: a.dark?.pageTexture ?? 'none', darkCustomTextureUrl: a.dark?.customTextureUrl ?? null, darkBgPage: a.dark?.bgPage ?? '#1e1e1e', darkBgApp: a.dark?.bgApp ?? '#121212' } });
      }
      if (bookData.sounds) {
        await tx.bookSounds.create({ data: { bookId: book.id, pageFlipUrl: bookData.sounds.pageFlip || 'sounds/page-flip.mp3', bookOpenUrl: bookData.sounds.bookOpen || 'sounds/cover-flip.mp3', bookCloseUrl: bookData.sounds.bookClose || 'sounds/cover-flip.mp3' } });
      }
      if (bookData.ambients?.length) {
        await tx.ambient.createMany({
          data: bookData.ambients.map((amb, i) => ({
            bookId: book.id, ambientKey: amb.ambientKey, label: amb.label,
            shortLabel: amb.shortLabel || null, icon: amb.icon || null,
            fileUrl: amb.fileUrl || null, visible: amb.visible ?? true,
            builtin: amb.builtin ?? false, position: i,
          })),
        });
      }
      if (bookData.decorativeFont) {
        await tx.decorativeFont.create({ data: { bookId: book.id, name: bookData.decorativeFont.name, fileUrl: bookData.decorativeFont.fileUrl } });
      }
      if (bookData.defaultSettings) {
        const ds = bookData.defaultSettings;
        await tx.bookDefaultSettings.create({ data: { bookId: book.id, font: ds.font || 'georgia', fontSize: ds.fontSize ?? 18, theme: ds.theme || 'light', soundEnabled: ds.soundEnabled ?? true, soundVolume: ds.soundVolume ?? 0.3, ambientType: ds.ambientType || 'none', ambientVolume: ds.ambientVolume ?? 0.5 } });
      }
    }
    if (data.readingFonts?.length) {
      await tx.readingFont.createMany({
        data: data.readingFonts.map((f, i) => ({
          userId, fontKey: f.fontKey, label: f.label, family: f.family,
          builtin: f.builtin ?? false, enabled: f.enabled ?? true,
          fileUrl: f.fileUrl || null, position: i,
        })),
      });
    }
    if (data.globalSettings) {
      const gs = data.globalSettings;
      await tx.globalSettings.upsert({
        where: { userId },
        create: { userId, fontMin: gs.fontMin ?? 14, fontMax: gs.fontMax ?? 22, visFontSize: gs.settingsVisibility?.fontSize ?? true, visTheme: gs.settingsVisibility?.theme ?? true, visFont: gs.settingsVisibility?.font ?? true, visFullscreen: gs.settingsVisibility?.fullscreen ?? true, visSound: gs.settingsVisibility?.sound ?? true, visAmbient: gs.settingsVisibility?.ambient ?? true },
        update: { fontMin: gs.fontMin ?? 14, fontMax: gs.fontMax ?? 22, visFontSize: gs.settingsVisibility?.fontSize ?? true, visTheme: gs.settingsVisibility?.theme ?? true, visFont: gs.settingsVisibility?.font ?? true, visFullscreen: gs.settingsVisibility?.fullscreen ?? true, visSound: gs.settingsVisibility?.sound ?? true, visAmbient: gs.settingsVisibility?.ambient ?? true },
      });
    }
  });
  return { imported: { books: data.books.length, fonts: data.readingFonts?.length ?? 0 } };
}
