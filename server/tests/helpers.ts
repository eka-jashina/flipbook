import { type Express } from 'express';
import request from 'supertest';
import { getPrisma } from '../src/utils/prisma.js';

type TestAgent = ReturnType<typeof request.agent>;

/**
 * Wrap a supertest agent so POST/PUT/PATCH/DELETE auto-include the CSRF header.
 */
function wrapAgentWithCsrf(agent: TestAgent, csrfToken: string): TestAgent {
  const methods = ['post', 'put', 'patch', 'delete'] as const;
  for (const method of methods) {
    const original = agent[method].bind(agent);
    (agent as any)[method] = (url: string) => original(url).set('x-csrf-token', csrfToken);
  }
  return agent;
}

/**
 * Create an unauthenticated agent with a valid CSRF token.
 * Use this for tests that need CSRF but no session (e.g. register/login tests).
 */
export async function createCsrfAgent(app: Express) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf-token').expect(200);
  const csrfToken: string = csrfRes.body.data.token;
  wrapAgentWithCsrf(agent, csrfToken);
  return { agent, csrfToken };
}

/**
 * Create a test user and return a logged-in agent with session cookie and CSRF token.
 * The agent auto-injects the CSRF header on POST/PUT/PATCH/DELETE requests.
 */
export async function createAuthenticatedAgent(
  app: Express,
  userData?: { email?: string; password?: string; displayName?: string },
) {
  const email = userData?.email || `test-${Date.now()}@example.com`;
  const password = userData?.password || 'TestPassword123!';
  const displayName = userData?.displayName || 'Test User';

  const agent = request.agent(app);

  // Get CSRF token (sets the CSRF cookie on the agent)
  const csrfRes = await agent.get('/api/auth/csrf-token').expect(200);
  const csrfToken: string = csrfRes.body.data.token;

  // Wrap agent to auto-include CSRF token on mutating requests
  wrapAgentWithCsrf(agent, csrfToken);

  // Register the user (CSRF header auto-injected)
  await agent
    .post('/api/auth/register')
    .send({ email, password, displayName })
    .expect(201);

  return { agent, email, password, displayName, csrfToken };
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
