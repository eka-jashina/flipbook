import { getPrisma } from '../utils/prisma.js';
import { verifyBookOwnership } from '../utils/ownership.js';
import type { ReadingProgressDetail } from '../types/api.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProgress(p: any): ReadingProgressDetail {
  return { page: p.page, font: p.font, fontSize: p.fontSize, theme: p.theme, soundEnabled: p.soundEnabled, soundVolume: p.soundVolume, ambientType: p.ambientType, ambientVolume: p.ambientVolume, updatedAt: p.updatedAt.toISOString() };
}

export async function getReadingProgress(bookId: string, userId: string): Promise<ReadingProgressDetail | null> {
  await verifyBookOwnership(bookId, userId);
  const prisma = getPrisma();
  const progress = await prisma.readingProgress.findUnique({ where: { userId_bookId: { userId, bookId } } });
  if (!progress) return null;
  return mapProgress(progress);
}

export async function upsertReadingProgress(bookId: string, userId: string, data: { page: number; font: string; fontSize: number; theme: string; soundEnabled: boolean; soundVolume: number; ambientType: string; ambientVolume: number }): Promise<ReadingProgressDetail> {
  await verifyBookOwnership(bookId, userId);
  const prisma = getPrisma();
  const progress = await prisma.readingProgress.upsert({ where: { userId_bookId: { userId, bookId } }, create: { userId, bookId, ...data }, update: data });
  return mapProgress(progress);
}
