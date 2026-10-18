import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';
import { ActivityEventType } from '@prisma/client';

describe('Transactional Activity History & Comments', () => {
  let ctx: TestContext;
  let itemId: string;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();

    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        title: 'Activity Tracking Work Item',
        description: 'Tracking item history through all lifecycle changes',
        teamId: ctx.platformTeam.id
      });

    itemId = createRes.body.id;
  });

  it('records CREATED, CLAIMED, UPDATED, and COMMENT_ADDED events in timeline', async () => {
    // 1. Claim
    await request(app)
      .post(`/api/items/${itemId}/claim`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`);

    // 2. Update priority
    await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 2,
        priority: 'URGENT'
      });

    // 3. Add Comment
    await request(app)
      .post(`/api/items/${itemId}/comments`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        body: 'Investigated memory dump. Heap allocation is stable now.'
      });

    // 4. Fetch activity timeline
    const activityRes = await request(app)
      .get(`/api/items/${itemId}/activity`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(activityRes.status).toBe(200);
    const eventTypes = activityRes.body.map((e: any) => e.eventType);

    expect(eventTypes).toContain(ActivityEventType.CREATED);
    expect(eventTypes).toContain(ActivityEventType.CLAIMED);
    expect(eventTypes).toContain(ActivityEventType.UPDATED);
    expect(eventTypes).toContain(ActivityEventType.COMMENT_ADDED);

    // Fetch comments
    const commentsRes = await request(app)
      .get(`/api/items/${itemId}/comments`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(commentsRes.status).toBe(200);
    expect(commentsRes.body.length).toBe(1);
    expect(commentsRes.body[0].body).toMatch(/Heap allocation is stable now/);
  });
});
