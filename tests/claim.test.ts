import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';
import { ActivityEventType } from '@prisma/client';

describe('Atomic Claiming & Concurrency Protection', () => {
  let ctx: TestContext;
  let unassignedItemId: string;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();

    // Create an unassigned open item
    const item = await prisma.workItem.create({
      data: {
        title: 'Unassigned High Priority Alert',
        description: 'Needs urgent resolution by a team member',
        teamId: ctx.platformTeam.id,
        creatorId: ctx.aliceAdmin.id,
        assigneeId: null,
        status: 'OPEN',
        version: 1
      }
    });

    unassignedItemId = item.id;
  });

  it('allows a member to claim an unassigned open item', async () => {
    const res = await request(app)
      .post(`/api/items/${unassignedItemId}/claim`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`);

    expect(res.status).toBe(200);
    expect(res.body.assigneeId).toBe(ctx.mayaMember.id);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.version).toBe(2);

    // Verify activity event was written in same transaction
    const events = await prisma.activityEvent.findMany({
      where: { workItemId: unassignedItemId, eventType: ActivityEventType.CLAIMED }
    });
    expect(events.length).toBe(1);
    expect(events[0].actorId).toBe(ctx.mayaMember.id);
  });

  it('guarantees under concurrent claims that exactly ONE request succeeds and others receive 409', async () => {
    // Generate simultaneous claim requests from Maya and Leo
    const promises = [
      request(app).post(`/api/items/${unassignedItemId}/claim`).set('Authorization', `Bearer ${ctx.mayaMember.token}`),
      request(app).post(`/api/items/${unassignedItemId}/claim`).set('Authorization', `Bearer ${ctx.leoLead.token}`),
      request(app).post(`/api/items/${unassignedItemId}/claim`).set('Authorization', `Bearer ${ctx.aliceAdmin.token}`)
    ];

    const responses = await Promise.all(promises);

    const successResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 409);

    expect(successResponses.length).toBe(1);
    expect(conflictResponses.length).toBe(2);

    // Database state check
    const finalItem = await prisma.workItem.findUnique({
      where: { id: unassignedItemId }
    });

    expect(finalItem?.status).toBe('IN_PROGRESS');
    expect(finalItem?.version).toBe(2);
    expect(finalItem?.assigneeId).toBe(successResponses[0].body.assigneeId);

    // Activity check
    const claimActivities = await prisma.activityEvent.findMany({
      where: { workItemId: unassignedItemId, eventType: ActivityEventType.CLAIMED }
    });
    expect(claimActivities.length).toBe(1);
  });
});
