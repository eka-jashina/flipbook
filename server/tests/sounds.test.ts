import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Sounds API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.id };
  }

  it('should return sounds with defaults', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/books/${bookId}/sounds`).expect(200);
    expect(res.body.pageFlip).toBe('sounds/page-flip.mp3');
    expect(res.body.bookOpen).toBe('sounds/cover-flip.mp3');
  });

  it('should require authentication', async () => {
    await request(app).get('/api/books/00000000-0000-0000-0000-000000000000/sounds').expect(401);
  });

  it('should update sound URLs', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.patch(`/api/books/${bookId}/sounds`).send({ pageFlip: 'custom/flip.mp3' }).expect(200);
    expect(res.body.pageFlip).toBe('custom/flip.mp3');
    expect(res.body.bookClose).toBe('sounds/cover-flip.mp3');
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/books/${bookId}/sounds`).expect(403);
  });
});
