import { getPrisma } from '../utils/prisma.js';
import { verifyBookOwnership } from '../utils/ownership.js';
import { AppError } from '../middleware/errorHandler.js';
import type { DecorativeFontDetail } from '../types/api.js';

export async function getDecorativeFont(bookId: string, userId: string): Promise<DecorativeFontDetail | null> {
  await verifyBookOwnership(bookId, userId);
  const prisma = getPrisma();
  const font = await prisma.decorativeFont.findUnique({ where: { bookId } });
  if (!font) return null;
  return { name: font.name, fileUrl: font.fileUrl };
}

export async function upsertDecorativeFont(bookId: string, userId: string, data: { name: string; fileUrl: string }): Promise<DecorativeFontDetail> {
  await verifyBookOwnership(bookId, userId);
  const prisma = getPrisma();
  const font = await prisma.decorativeFont.upsert({
    where: { bookId },
    create: { bookId, name: data.name, fileUrl: data.fileUrl },
    update: { name: data.name, fileUrl: data.fileUrl },
  });
  return { name: font.name, fileUrl: font.fileUrl };
}

export async function deleteDecorativeFont(bookId: string, userId: string): Promise<void> {
  await verifyBookOwnership(bookId, userId);
  const prisma = getPrisma();
  const font = await prisma.decorativeFont.findUnique({ where: { bookId } });
  if (!font) throw new AppError(404, 'Decorative font not found');
  await prisma.decorativeFont.delete({ where: { bookId } });
}
