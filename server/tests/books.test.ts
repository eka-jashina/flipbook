import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Books API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/books', () => {
    it('should return empty list for new user', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const res = await agent.get('/api/books').expect(200);
      expect(res.body.data.books).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/books').expect(401);
    });
  });

  describe('POST /api/books', () => {
    it('should create a new book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const res = await agent
        .post('/api/books')
        .send({ title: 'Test Book', author: 'Test Author' })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Test Book');
      expect(res.body.data.author).toBe('Test Author');
      expect(res.body.data.chapters).toEqual([]);
      expect(res.body.data.appearance).toBeDefined();
      expect(res.body.data.sounds).toBeDefined();
      expect(res.body.data.defaultSettings).toBeDefined();
    });

    it('should require title', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      await agent.post('/api/books').send({ author: 'No Title' }).expect(400);
    });

    it('should auto-increment position', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      await agent
        .post('/api/books')
        .send({ title: 'Book 1' })
        .expect(201);

      await agent
        .post('/api/books')
        .send({ title: 'Book 2' })
        .expect(201);

      const res = await agent.get('/api/books').expect(200);
      expect(res.body.data.books).toHaveLength(2);
      expect(res.body.data.books[0].position).toBe(0);
      expect(res.body.data.books[1].position).toBe(1);
    });
  });

  describe('GET /api/books/:bookId', () => {
    it('should return book details', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/books')
        .send({ title: 'Detail Book', author: 'Author' })
        .expect(201);

      const res = await agent
        .get(`/api/books/${createRes.body.data.id}`)
        .expect(200);

      expect(res.body.data.title).toBe('Detail Book');
      expect(res.body.data.cover).toBeDefined();
      expect(res.body.data.appearance).toBeDefined();
    });

    it('should return 404 for non-existent book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      await agent
        .get('/api/books/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should not allow access to another user\'s book', async () => {
      const { agent: agent1 } = await createAuthenticatedAgent(app, {
        email: 'user1@example.com',
      });
      const { agent: agent2 } = await createAuthenticatedAgent(app, {
        email: 'user2@example.com',
      });

      const createRes = await agent1
        .post('/api/books')
        .send({ title: 'Private Book' })
        .expect(201);

      await agent2.get(`/api/books/${createRes.body.data.id}`).expect(403);
    });
  });

  describe('PATCH /api/books/:bookId', () => {
    it('should update book metadata', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/books')
        .send({ title: 'Original Title' })
        .expect(201);

      const res = await agent
        .patch(`/api/books/${createRes.body.data.id}`)
        .send({ title: 'Updated Title', author: 'New Author' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.author).toBe('New Author');
    });
  });

  describe('DELETE /api/books/:bookId', () => {
    it('should delete a book', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const createRes = await agent
        .post('/api/books')
        .send({ title: 'To Delete' })
        .expect(201);

      await agent
        .delete(`/api/books/${createRes.body.data.id}`)
        .expect(204);

      const res = await agent.get('/api/books').expect(200);
      expect(res.body.data.books).toHaveLength(0);
    });
  });

  describe('PATCH /api/books/reorder', () => {
    it('should reorder books', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      const book1 = await agent
        .post('/api/books')
        .send({ title: 'Book A' })
        .expect(201);
      const book2 = await agent
        .post('/api/books')
        .send({ title: 'Book B' })
        .expect(201);

      // Reverse order
      await agent
        .patch('/api/books/reorder')
        .send({ bookIds: [book2.body.data.id, book1.body.data.id] })
        .expect(200);

      const res = await agent.get('/api/books').expect(200);
      expect(res.body.data.books[0].title).toBe('Book B');
      expect(res.body.data.books[1].title).toBe('Book A');
    });
  });
});
