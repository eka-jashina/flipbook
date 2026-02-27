import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Ambients API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  async function createBookWithAgent() {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/books').send({ title: 'Test Book', author: 'Author' }).expect(201);
    return { agent, bookId: bookRes.body.data.id };
  }

  it('should return empty ambients list', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.get(`/api/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients).toEqual([]);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/books/00000000-0000-0000-0000-000000000000/ambients').expect(401);
  });

  it('should create an ambient', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const res = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    expect(res.body.data.ambientKey).toBe('rain');
    expect(res.body.data.position).toBe(0);
  });

  it('should auto-increment position', async () => {
    const { agent, bookId } = await createBookWithAgent();
    await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    const res = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'fire', label: 'Fire' }).expect(201);
    expect(res.body.data.position).toBe(1);
  });

  it('should update ambient', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const cr = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    const res = await agent.patch(`/api/books/${bookId}/ambients/${cr.body.data.id}`).send({ label: 'Heavy Rain', visible: false }).expect(200);
    expect(res.body.data.label).toBe('Heavy Rain');
    expect(res.body.data.visible).toBe(false);
  });

  it('should delete an ambient', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const cr = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    await agent.delete(`/api/books/${bookId}/ambients/${cr.body.data.id}`).expect(204);
    const res = await agent.get(`/api/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients).toHaveLength(0);
  });

  it('should reorder ambients', async () => {
    const { agent, bookId } = await createBookWithAgent();
    const a1 = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'rain', label: 'Rain' }).expect(201);
    const a2 = await agent.post(`/api/books/${bookId}/ambients`).send({ ambientKey: 'fire', label: 'Fire' }).expect(201);
    await agent.patch(`/api/books/${bookId}/ambients/reorder`).send({ ambientIds: [a2.body.data.id, a1.body.data.id] }).expect(200);
    const res = await agent.get(`/api/books/${bookId}/ambients`).expect(200);
    expect(res.body.data.ambients[0].ambientKey).toBe('fire');
  });

  it('should return 403 for another user', async () => {
    const { bookId } = await createBookWithAgent();
    const { agent: agent2 } = await createAuthenticatedAgent(app, { email: 'other@example.com' });
    await agent2.get(`/api/books/${bookId}/ambients`).expect(403);
  });
});
