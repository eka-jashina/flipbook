import { getPrisma } from '../utils/prisma.js';
import { verifyBookOwnership } from '../utils/ownership.js';
import { AppError } from '../middleware/errorHandler.js';
import type { DefaultSettings } from '../types/api.js';

/**
 * Get default settings for a book.
 */
export async function getDefaultSettings(
  bookId: string,
  userId: string,
): Promise<DefaultSettings> {
  await verifyBookOwnership(bookId, userId);

  const prisma = getPrisma();
  const settings = await prisma.bookDefaultSettings.findUnique({
    where: { bookId },
  });

  if (!settings) {
    throw new AppError(404, 'Default settings not found');
  }

  return {
    font: settings.font,
    fontSize: settings.fontSize,
    theme: settings.theme,
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume,
    ambientType: settings.ambientType,
    ambientVolume: settings.ambientVolume,
  };
}

/**
 * Update default settings for a book.
 */
export async function updateDefaultSettings(
  bookId: string,
  userId: string,
  data: {
    font?: string;
    fontSize?: number;
    theme?: string;
    soundEnabled?: boolean;
    soundVolume?: number;
    ambientType?: string;
    ambientVolume?: number;
  },
): Promise<DefaultSettings> {
  await verifyBookOwnership(bookId, userId);

  const prisma = getPrisma();
  const settings = await prisma.bookDefaultSettings.upsert({
    where: { bookId },
    create: { bookId, ...data },
    update: data,
  });

  return {
    font: settings.font,
    fontSize: settings.fontSize,
    theme: settings.theme,
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume,
    ambientType: settings.ambientType,
    ambientVolume: settings.ambientVolume,
  };
}
