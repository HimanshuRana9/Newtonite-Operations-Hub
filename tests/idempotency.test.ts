import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';

describe('Idempotent Work Item Creation', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();
  });

  it('returns original item when repeated request has identical key and payload', async () => {
    const idempotencyKey = 'req-key-12345';
    const payload = {
      title: 'Incident: Network Switch Packet Drops',
      description: 'Core spine switch reporting CRC errors on interface 4',
      teamId: ctx.platformTeam.id
    };

    // First request
    const firstRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const createdId = firstRes.body.id;

    // Second request with same key and same payload
    const secondRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.id).toBe(createdId);

    // Verify exactly ONE item exists in PostgreSQL
    const totalItems = await prisma.workItem.count({
      where: { title: payload.title }
    });
    expect(totalItems).toBe(1);
  });

  it('rejects reuse of key with a different payload with 409 Conflict', async () => {
    const idempotencyKey = 'req-key-conflicting-payload';

    // First request
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        title: 'Original Title',
        description: 'Original Description Details',
        teamId: ctx.platformTeam.id
      });

    // Second request with same key but altered payload
    const secondRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        title: 'Tampered Different Title',
        description: 'Different Description Details',
        teamId: ctx.platformTeam.id
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error).toMatch(/Idempotency-Key reuse detected with different request payload/i);
  });

  it('guarantees under concurrent duplicate requests that exactly ONE item is created', async () => {
    const idempotencyKey = 'req-concurrent-duplicate-key';
    const payload = {
      title: 'High Concurrency Incident Trigger',
      description: 'Multiple client threads submit identical creation payloads simultaneously',
      teamId: ctx.platformTeam.id
    };

    const promises = Array.from({ length: 4 }).map(() =>
      request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
    );

    const responses = await Promise.all(promises);

    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
      expect(res.body.title).toBe(payload.title);
    }

    const totalCount = await prisma.workItem.count({
      where: { title: payload.title }
    });
    expect(totalCount).toBe(1);
  });
});
