import { randomBytes } from 'node:crypto';
import { getPrisma } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import type { UserResponse } from '../types/api.js';

/** Password reset token validity period (1 hour) */
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Format a User model for the API response.
 * Accepts both Prisma user (with passwordHash) and Express.User (with hasPassword).
 */
export function formatUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  googleId: string | null;
  passwordHash?: string | null;
  hasPassword?: boolean;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    hasPassword: user.hasPassword ?? (user.passwordHash !== null),
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

/**
 * Create a password reset token for a user.
 * Returns the token string. The caller is responsible for delivering
 * it to the user (e.g., via email). If no user exists with the given
 * email, returns null silently to prevent email enumeration.
 */
export async function createPasswordResetToken(
  email: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true },
  });

  // Silently return null to prevent email enumeration
  if (!user) return null;

  // Only users with passwords can reset (Google-only users should use Google)
  if (!user.passwordHash) return null;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiresAt: expiresAt,
    },
  });

  logger.info({ userId: user.id }, 'Password reset token created');
  return token;
}

/**
 * Reset a user's password using a valid reset token.
 * Clears the token after successful reset and destroys all sessions.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<void> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { resetToken: token },
    select: { id: true, resetTokenExpiresAt: true },
  });

  if (!user) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    // Clean up expired token
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiresAt: null },
    });
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  // Invalidate all existing sessions for this user.
  // The session table uses "sess" JSONB column with passport.user = user.id
  try {
    await prisma.$executeRaw`
      DELETE FROM "session" WHERE sess::text LIKE ${'%"' + user.id + '"%'}
    `;
  } catch {
    // Non-critical: session cleanup failure is logged but doesn't block reset
    logger.warn({ userId: user.id }, 'Failed to invalidate sessions after password reset');
  }

  logger.info({ userId: user.id }, 'Password reset completed');
}
