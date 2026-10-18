import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';

describe('Optimistic Concurrency Control (Stale Edits)', () => {
  let ctx: TestContext;
  let itemId: string;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();

    const item = await prisma.workItem.create({
      data: {
        title: 'Original Title',
        description: 'Original Description',
        teamId: ctx.platformTeam.id,
        creatorId: ctx.aliceAdmin.id,
        assigneeId: ctx.mayaMember.id,
        status: 'IN_PROGRESS',
        version: 1
      }
    });

    itemId = item.id;
  });

  it('updates item successfully when matching version is provided', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 1,
        title: 'Updated Title by Maya'
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title by Maya');
    expect(res.body.version).toBe(2);
  });

  it('rejects stale update with 409 Conflict when version is out of date', async () => {
    // 1. First edit increments version from 1 to 2
    await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.aliceAdmin.token}`)
      .send({
        version: 1,
        title: 'Admin Edit'
      });

    // 2. Second edit uses stale version 1
    const staleRes = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 1,
        title: 'Maya Stale Overwrite Attempt'
      });

    expect(staleRes.status).toBe(409);
    expect(staleRes.body.error).toMatch(/Conflict: Stale update/i);

    // Verify database remains at version 2 with Admin Edit
    const dbItem = await prisma.workItem.findUnique({ where: { id: itemId } });
    expect(dbItem?.title).toBe('Admin Edit');
    expect(dbItem?.version).toBe(2);
  });
});
