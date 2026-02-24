import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Chapters API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  async function createBookWithAgent(app: ReturnType<typeof createApp>) {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent
      .post('/api/books')
      .send({ title: 'Test Book', author: 'Author' })
      .expect(201);
    return { agent, bookId: bookRes.body.id };
  }

  describe('GET /api/books/:bookId/chapters', () => {
    it('should return empty chapter list for new book', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const res = await agent
        .get(`/api/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.chapters).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/books/00000000-0000-0000-0000-000000000000/chapters')
        .expect(401);
    });
  });

  describe('POST /api/books/:bookId/chapters', () => {
    it('should create a chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const res = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({
          title: 'Chapter 1',
          htmlContent: '<p>Hello world</p>',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Chapter 1');
      expect(res.body.hasHtmlContent).toBe(true);
      expect(res.body.htmlContent).toBe('<p>Hello world</p>');
    });

    it('should auto-increment position', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Ch 1' })
        .expect(201);

      const ch2 = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Ch 2' })
        .expect(201);

      expect(ch2.body.position).toBe(1);
    });
  });

  describe('GET /api/books/:bookId/chapters/:chapterId', () => {
    it('should return chapter details', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Detail Chapter', htmlContent: '<p>Content</p>' })
        .expect(201);

      const res = await agent
        .get(`/api/books/${bookId}/chapters/${createRes.body.id}`)
        .expect(200);

      expect(res.body.title).toBe('Detail Chapter');
      expect(res.body.htmlContent).toBe('<p>Content</p>');
    });

    it('should return 404 for non-existent chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      await agent
        .get(
          `/api/books/${bookId}/chapters/00000000-0000-0000-0000-000000000000`,
        )
        .expect(404);
    });
  });

  describe('GET /api/books/:bookId/chapters/:chapterId/content', () => {
    it('should return chapter HTML content', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({
          title: 'Content Chapter',
          htmlContent: '<h1>Title</h1><p>Body text</p>',
        })
        .expect(201);

      const res = await agent
        .get(
          `/api/books/${bookId}/chapters/${createRes.body.id}/content`,
        )
        .expect(200);

      expect(res.body.html).toBe('<h1>Title</h1><p>Body text</p>');
    });
  });

  describe('PATCH /api/books/:bookId/chapters/:chapterId', () => {
    it('should update chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Original' })
        .expect(201);

      const res = await agent
        .patch(
          `/api/books/${bookId}/chapters/${createRes.body.id}`,
        )
        .send({ title: 'Updated', htmlContent: '<p>New content</p>' })
        .expect(200);

      expect(res.body.title).toBe('Updated');
      expect(res.body.htmlContent).toBe('<p>New content</p>');
    });
  });

  describe('DELETE /api/books/:bookId/chapters/:chapterId', () => {
    it('should delete a chapter', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const createRes = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'To Delete' })
        .expect(201);

      await agent
        .delete(
          `/api/books/${bookId}/chapters/${createRes.body.id}`,
        )
        .expect(204);

      const res = await agent
        .get(`/api/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.chapters).toHaveLength(0);
    });
  });

  describe('PATCH /api/books/:bookId/chapters/reorder', () => {
    it('should reorder chapters', async () => {
      const { agent, bookId } = await createBookWithAgent(app);

      const ch1 = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Ch A' })
        .expect(201);

      const ch2 = await agent
        .post(`/api/books/${bookId}/chapters`)
        .send({ title: 'Ch B' })
        .expect(201);

      await agent
        .patch(`/api/books/${bookId}/chapters/reorder`)
        .send({ chapterIds: [ch2.body.id, ch1.body.id] })
        .expect(200);

      const res = await agent
        .get(`/api/books/${bookId}/chapters`)
        .expect(200);

      expect(res.body.chapters[0].title).toBe('Ch B');
      expect(res.body.chapters[1].title).toBe('Ch A');
    });
  });
});
