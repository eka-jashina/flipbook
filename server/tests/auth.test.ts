import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { cleanDatabase, createAuthenticatedAgent, createCsrfAgent } from './helpers.js';

const app = createApp();

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'Password123!',
          displayName: 'New User',
        })
        .expect(201);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('new@example.com');
      expect(res.body.data.user.displayName).toBe('New User');
      expect(res.body.data.user.hasPassword).toBe(true);
      expect(res.body.data.user.hasGoogle).toBe(false);
      // Should not expose password hash
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject duplicate emails', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/auth/register')
        .send({ email: 'dup@example.com', password: 'Password123!' })
        .expect(201);

      const res = await agent
        .post('/api/auth/register')
        .send({ email: 'dup@example.com', password: 'Password123!' })
        .expect(409);

      expect(res.body.error).toBe('AppError');
    });

    it('should reject weak passwords', async () => {
      const { agent } = await createCsrfAgent(app);

      const res = await agent
        .post('/api/auth/register')
        .send({ email: 'weak@example.com', password: 'short' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('should reject invalid emails', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Password123!' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { agent } = await createCsrfAgent(app);

      // Register first
      await agent
        .post('/api/auth/register')
        .send({ email: 'login@example.com', password: 'Password123!' });

      // Logout so we can test login
      await agent.post('/api/auth/logout');

      const res = await agent
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'Password123!' })
        .expect(200);

      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should reject invalid password', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/auth/register')
        .send({ email: 'wrong@example.com', password: 'Password123!' });

      await agent.post('/api/auth/logout');

      await agent
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: 'WrongPassword!' })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      const { agent } = await createCsrfAgent(app);

      await agent
        .post('/api/auth/login')
        .send({ email: 'nouser@example.com', password: 'Password123!' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const { agent, email } = await createAuthenticatedAgent(app);

      const res = await agent.get('/api/auth/me').expect(200);
      expect(res.body.data.user.email).toBe(email);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session', async () => {
      const { agent } = await createAuthenticatedAgent(app);

      // Should be authenticated
      await agent.get('/api/auth/me').expect(200);

      // Logout
      await agent.post('/api/auth/logout').expect(200);

      // Should no longer be authenticated
      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('CSRF protection', () => {
    it('should reject POST without CSRF token', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123!' })
        .expect(403);
    });

    it('should allow GET without CSRF token', async () => {
      const res = await request(app).get('/api/auth/csrf-token').expect(200);
      expect(res.body.data.token).toBeDefined();
    });
  });
});
