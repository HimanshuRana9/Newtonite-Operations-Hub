import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetAndSeedDatabase } from './helpers.js';

describe('Authentication & Current User API', () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  it('rejects unauthenticated requests to protected endpoints with 401', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authentication required/i);
  });

  it('authenticates valid credentials and returns JWT token and memberships', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.io', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('Alice Admin');
    expect(res.body.user.memberships.length).toBeGreaterThan(0);
    expect(res.body.user.memberships[0].role).toBe('ADMIN');
  });

  it('rejects invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.io', password: 'WrongPassword' });

    expect(res.status).toBe(401);
  });

  it('returns current user details on /api/auth/me with valid Bearer token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maya@test.io', password: 'Password123!' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.name).toBe('Maya Member');
    expect(meRes.body.memberships[0].role).toBe('MEMBER');
  });
});
