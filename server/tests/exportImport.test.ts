import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent } from './helpers.js';

const app = createApp();

describe('Export/Import API', () => {
  beforeEach(async () => { await cleanDatabase(); });

  it('should export empty config', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/export').expect(200);
    expect(res.body.books).toEqual([]);
    expect(res.body.readingFonts).toEqual([]);
    // Registration auto-creates default global settings
    expect(res.body.globalSettings).toEqual({
      fontMin: 14,
      fontMax: 22,
      settingsVisibility: {
        fontSize: true, theme: true, font: true,
        fullscreen: true, sound: true, ambient: true,
      },
    });
  });

  it('should include Content-Disposition header', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const res = await agent.get('/api/export').expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('should export books with chapters', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const bookRes = await agent.post('/api/books').send({ title: 'My Book', author: 'Me' }).expect(201);
    await agent.post(`/api/books/${bookRes.body.id}/chapters`).send({ title: 'Ch 1', htmlContent: '<p>Hi</p>' }).expect(201);
    const res = await agent.get('/api/export').expect(200);
    expect(res.body.books).toHaveLength(1);
    expect(res.body.books[0].chapters).toHaveLength(1);
  });

  it('should import books and fonts', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    const importData = {
      books: [{ title: 'Imported', author: 'A', cover: { bg: '', bgMobile: '', bgMode: 'default', bgCustomUrl: null }, chapters: [{ title: 'Ch 1', position: 0, filePath: null, hasHtmlContent: false, bg: '', bgMobile: '' }], defaultSettings: null, appearance: null, sounds: null, ambients: [], decorativeFont: null }],
      readingFonts: [{ fontKey: 'georgia', label: 'Georgia', family: 'Georgia', builtin: true, enabled: true, fileUrl: null, position: 0 }],
      globalSettings: { fontMin: 12, fontMax: 28, settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: false, sound: true, ambient: false } },
    };
    const res = await agent.post('/api/import').send(importData).expect(200);
    expect(res.body.imported.books).toBe(1);
    expect(res.body.imported.fonts).toBe(1);

    const exp = await agent.get('/api/export').expect(200);
    expect(exp.body.books).toHaveLength(1);
    expect(exp.body.readingFonts).toHaveLength(1);
    expect(exp.body.globalSettings?.fontMin).toBe(12);
  });

  it('should reject invalid payload', async () => {
    const { agent } = await createAuthenticatedAgent(app);
    await agent.post('/api/import').send({ invalid: 'data' }).expect(400);
  });

  it('should require authentication', async () => {
    await request(app).get('/api/export').expect(401);
  });
});
