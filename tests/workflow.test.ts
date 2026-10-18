import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';
import { WorkItemStatus, ActivityEventType } from '@prisma/client';

describe('Workflow State Machine & Approval Roles', () => {
  let ctx: TestContext;
  let itemId: string;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();

    const item = await prisma.workItem.create({
      data: {
        title: 'Workflow Item',
        description: 'Testing lifecycle transitions',
        teamId: ctx.platformTeam.id,
        creatorId: ctx.aliceAdmin.id,
        assigneeId: ctx.mayaMember.id,
        status: WorkItemStatus.OPEN,
        version: 1
      }
    });

    itemId = item.id;
  });

  it('rejects invalid state transition with 400', async () => {
    // OPEN -> RESOLVED is not an allowed direct transition
    const res = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 1,
        targetStatus: WorkItemStatus.RESOLVED
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid workflow transition/i);
  });

  it('progresses OPEN -> IN_PROGRESS -> AWAITING_APPROVAL by Member', async () => {
    // 1. OPEN -> IN_PROGRESS
    const res1 = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 1,
        targetStatus: WorkItemStatus.IN_PROGRESS
      });

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe(WorkItemStatus.IN_PROGRESS);
    expect(res1.body.version).toBe(2);

    // 2. IN_PROGRESS -> AWAITING_APPROVAL
    const res2 = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 2,
        targetStatus: WorkItemStatus.AWAITING_APPROVAL
      });

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe(WorkItemStatus.AWAITING_APPROVAL);
    expect(res2.body.version).toBe(3);
  });

  it('rejects Member attempting approval with 403 Forbidden', async () => {
    // Put item in AWAITING_APPROVAL with version 2
    await prisma.workItem.update({
      where: { id: itemId },
      data: { status: WorkItemStatus.AWAITING_APPROVAL, version: 2 }
    });

    // Maya Member attempts approval
    const res = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 2,
        targetStatus: WorkItemStatus.RESOLVED
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/requires at least LEAD role/i);
  });

  it('allows Lead to approve eligible item and records APPROVED activity event', async () => {
    // Put item in AWAITING_APPROVAL with version 2
    await prisma.workItem.update({
      where: { id: itemId },
      data: { status: WorkItemStatus.AWAITING_APPROVAL, version: 2 }
    });

    // Leo Lead performs approval
    const res = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.leoLead.token}`)
      .send({
        version: 2,
        targetStatus: WorkItemStatus.RESOLVED,
        reason: 'Verified peer review and unit test coverage'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(WorkItemStatus.RESOLVED);
    expect(res.body.version).toBe(3);

    // Verify activity event was created with APPROVED type
    const event = await prisma.activityEvent.findFirst({
      where: { workItemId: itemId, eventType: ActivityEventType.APPROVED }
    });
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(ctx.leoLead.id);
  });

  it('allows Lead to reject item back to IN_PROGRESS and records REJECTED activity event', async () => {
    // Put item in AWAITING_APPROVAL with version 2
    await prisma.workItem.update({
      where: { id: itemId },
      data: { status: WorkItemStatus.AWAITING_APPROVAL, version: 2 }
    });

    // Leo Lead rejects item back to IN_PROGRESS with reason
    const res = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.leoLead.token}`)
      .send({
        version: 2,
        targetStatus: WorkItemStatus.IN_PROGRESS,
        reason: 'Requires additional integration test for edge cases'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(WorkItemStatus.IN_PROGRESS);
    expect(res.body.version).toBe(3);

    const event = await prisma.activityEvent.findFirst({
      where: { workItemId: itemId, eventType: ActivityEventType.REJECTED }
    });
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(ctx.leoLead.id);
    expect((event?.metadata as any)?.reason).toMatch(/additional integration test/);
  });

  it('enforces that closing a RESOLVED item requires LEAD role and Member is rejected', async () => {
    // Put item in RESOLVED with version 3
    await prisma.workItem.update({
      where: { id: itemId },
      data: { status: WorkItemStatus.RESOLVED, version: 3 }
    });

    // Member attempts to close -> 403 Forbidden
    const memberRes = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        version: 3,
        targetStatus: WorkItemStatus.CLOSED
      });

    expect(memberRes.status).toBe(403);
    expect(memberRes.body.error).toMatch(/requires at least LEAD role/i);

    // Lead closes item -> 200 OK
    const leadRes = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.leoLead.token}`)
      .send({
        version: 3,
        targetStatus: WorkItemStatus.CLOSED
      });

    expect(leadRes.status).toBe(200);
    expect(leadRes.body.status).toBe(WorkItemStatus.CLOSED);
    expect(leadRes.body.version).toBe(4);
  });

  it('enforces that reopening a CLOSED item strictly requires ADMIN role', async () => {
    // Put item in CLOSED with version 4
    await prisma.workItem.update({
      where: { id: itemId },
      data: { status: WorkItemStatus.CLOSED, version: 4 }
    });

    // 1. Member attempts to reopen -> 403
    const memberRes = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({ version: 4, targetStatus: WorkItemStatus.OPEN });
    expect(memberRes.status).toBe(403);

    // 2. Lead attempts to reopen -> 403 (Requires ADMIN)
    const leadRes = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.leoLead.token}`)
      .send({ version: 4, targetStatus: WorkItemStatus.OPEN });
    expect(leadRes.status).toBe(403);
    expect(leadRes.body.error).toMatch(/requires at least ADMIN role/i);

    // 3. Admin reopens -> 200 OK
    const adminRes = await request(app)
      .post(`/api/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${ctx.aliceAdmin.token}`)
      .send({ version: 4, targetStatus: WorkItemStatus.OPEN });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.status).toBe(WorkItemStatus.OPEN);
    expect(adminRes.body.version).toBe(5);
  });
});
