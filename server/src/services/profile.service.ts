import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESERVED_USERNAMES } from '../schemas.js';
import type { UserResponse } from '../types/api.js';
import { formatUser } from './auth.service.js';

/**
 * Check if a username is available (not taken and not reserved).
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (RESERVED_USERNAMES.has(username)) return false;

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return !existing;
}

/**
 * Get the current user's profile.
 */
export async function getProfile(userId: string): Promise<UserResponse> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  return formatUser(user);
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  userId: string,
  data: {
    username?: string;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  },
): Promise<UserResponse> {
  const prisma = getPrisma();

  // If username is being changed, check availability
  if (data.username !== undefined) {
    const available = await isUsernameAvailable(data.username);
    if (!available) {
      // Check if user already owns this username
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      if (current?.username !== data.username) {
        throw new AppError(409, 'Username is already taken');
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.username !== undefined && { username: data.username }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
    },
  });

  return formatUser(user);
}
