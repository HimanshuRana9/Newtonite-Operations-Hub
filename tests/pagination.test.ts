import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';
import { Priority, WorkItemStatus } from '@prisma/client';

describe('Server-Side Filtering, Search & Cursor Pagination', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();

    // Create 15 items with deliberate priorities and titles
    for (let i = 1; i <= 15; i++) {
      await prisma.workItem.create({
        data: {
          title: `Item-${i.toString().padStart(2, '0')}: Memory Profiling Task`,
          description: `Detailed description for load testing number ${i}`,
          teamId: ctx.platformTeam.id,
          creatorId: ctx.aliceAdmin.id,
          assigneeId: i % 2 === 0 ? ctx.mayaMember.id : null,
          priority: i <= 5 ? Priority.URGENT : Priority.MEDIUM,
          status: i <= 5 ? WorkItemStatus.OPEN : WorkItemStatus.IN_PROGRESS,
          version: 1,
          createdAt: new Date(Date.now() - (20 - i) * 1000) // distinct timestamps
        }
      });
    }
  });

  it('paginates results using stable cursor (createdAt DESC, id DESC)', async () => {
    // Request page 1 of 5 items
    const page1Res = await request(app)
      .get('/api/items?limit=5')
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.items.length).toBe(5);
    expect(page1Res.body.hasMore).toBe(true);
    expect(page1Res.body.nextCursor).toBeDefined();

    const cursor = page1Res.body.nextCursor;

    // Request page 2 using cursor
    const page2Res = await request(app)
      .get(`/api/items?limit=5&cursor=${encodeURIComponent(cursor)}`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(page2Res.status).toBe(200);
    expect(page2Res.body.items.length).toBe(5);

    // Verify disjoint sets (no overlap)
    const page1Ids = page1Res.body.items.map((it: any) => it.id);
    const page2Ids = page2Res.body.items.map((it: any) => it.id);
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('filters by status and priority on server', async () => {
    const res = await request(app)
      .get('/api/items?status=OPEN&priority=URGENT')
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
    for (const item of res.body.items) {
      expect(item.status).toBe('OPEN');
      expect(item.priority).toBe('URGENT');
    }
  });

  it('filters by search term in title or description', async () => {
    const res = await request(app)
      .get('/api/items?search=Item-03')
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toMatch(/Item-03/);
  });
});
