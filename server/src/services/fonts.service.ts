import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import type { ReadingFontItem } from '../types/api.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFont(f: any): ReadingFontItem {
  return { id: f.id, fontKey: f.fontKey, label: f.label, family: f.family, builtin: f.builtin, enabled: f.enabled, fileUrl: f.fileUrl, position: f.position };
}

export async function getReadingFonts(userId: string): Promise<ReadingFontItem[]> {
  const prisma = getPrisma();
  const fonts = await prisma.readingFont.findMany({ where: { userId }, orderBy: { position: 'asc' } });
  return fonts.map(mapFont);
}

export async function createReadingFont(userId: string, data: { fontKey: string; label: string; family: string; builtin?: boolean; enabled?: boolean; fileUrl?: string }): Promise<ReadingFontItem> {
  const prisma = getPrisma();
  const count = await prisma.readingFont.count({ where: { userId } });
  if (count >= RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
    throw new AppError(403, `Font limit reached (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`);
  }
  const last = await prisma.readingFont.findFirst({ where: { userId }, orderBy: { position: 'desc' }, select: { position: true } });
  const font = await prisma.readingFont.create({
    data: { userId, fontKey: data.fontKey, label: data.label, family: data.family, builtin: data.builtin ?? false, enabled: data.enabled ?? true, fileUrl: data.fileUrl || null, position: (last?.position ?? -1) + 1 },
  });
  return mapFont(font);
}

export async function updateReadingFont(fontId: string, userId: string, data: { label?: string; family?: string; enabled?: boolean; fileUrl?: string | null }): Promise<ReadingFontItem> {
  const prisma = getPrisma();
  const font = await prisma.readingFont.findUnique({ where: { id: fontId }, select: { userId: true } });
  if (!font) throw new AppError(404, 'Font not found');
  if (font.userId !== userId) throw new AppError(403, 'Access denied');
  const updated = await prisma.readingFont.update({
    where: { id: fontId },
    data: { ...(data.label !== undefined && { label: data.label }), ...(data.family !== undefined && { family: data.family }), ...(data.enabled !== undefined && { enabled: data.enabled }), ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }) },
  });
  return mapFont(updated);
}

export async function deleteReadingFont(fontId: string, userId: string): Promise<void> {
  const prisma = getPrisma();
  const font = await prisma.readingFont.findUnique({ where: { id: fontId }, select: { userId: true } });
  if (!font) throw new AppError(404, 'Font not found');
  if (font.userId !== userId) throw new AppError(403, 'Access denied');
  await prisma.readingFont.delete({ where: { id: fontId } });
}

export async function reorderReadingFonts(userId: string, fontIds: string[]): Promise<void> {
  const prisma = getPrisma();
  const fonts = await prisma.readingFont.findMany({ where: { userId, id: { in: fontIds } }, select: { id: true } });
  if (fonts.length !== fontIds.length) throw new AppError(400, 'Some font IDs are invalid');
  await prisma.$transaction(fontIds.map((id, index) => prisma.readingFont.update({ where: { id }, data: { position: index } })));
}
