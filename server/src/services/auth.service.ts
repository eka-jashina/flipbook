import { getPrisma } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import type { UserResponse } from '../types/api.js';

/**
 * Format a User model for the API response.
 */
export function formatUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  googleId: string | null;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    hasPassword: user.passwordHash !== null,
    hasGoogle: user.googleId !== null,
  };
}

/**
 * Register a new user with email and password.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName?: string,
): Promise<UserResponse> {
  const prisma = getPrisma();

  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new AppError(409, 'User with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      displayName: displayName || null,
    },
  });

  // Create default global settings for new user
  await prisma.globalSettings.create({
    data: { userId: user.id },
  });

  return formatUser(user);
}

/**
 * Get user by ID.
 */
export async function getUserById(
  id: string,
): Promise<UserResponse | null> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  return formatUser(user);
}
