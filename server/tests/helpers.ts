import { type Express } from 'express';
import request from 'supertest';
import { getPrisma } from '../src/utils/prisma.js';

/**
 * Create a test user and return a logged-in agent with session cookie.
 */
export async function createAuthenticatedAgent(
  app: Express,
  userData?: { email?: string; password?: string; displayName?: string },
) {
  const email = userData?.email || `test-${Date.now()}@example.com`;
  const password = userData?.password || 'TestPassword123!';
  const displayName = userData?.displayName || 'Test User';

  const agent = request.agent(app);

  // Register the user
  await agent
    .post('/api/auth/register')
    .send({ email, password, displayName })
    .expect(201);

  return { agent, email, password, displayName };
}

/**
 * Clean up test data from the database.
 */
export async function cleanDatabase() {
  const prisma = getPrisma();

  // Delete in order respecting foreign key constraints
  await prisma.readingProgress.deleteMany();
  await prisma.ambient.deleteMany();
  await prisma.decorativeFont.deleteMany();
  await prisma.bookDefaultSettings.deleteMany();
  await prisma.bookSounds.deleteMany();
  await prisma.bookAppearance.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.book.deleteMany();
  await prisma.readingFont.deleteMany();
  await prisma.globalSettings.deleteMany();
  await prisma.user.deleteMany();
  // Clean session table (managed by connect-pg-simple, not Prisma)
  await prisma.$executeRawUnsafe('DELETE FROM "session"');
}
