import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server/app.js';
import { resetAndSeedDatabase, TestContext } from './helpers.js';

describe('Team-Scoped Authorization & Role Enforcements', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await resetAndSeedDatabase();
  });

  it('rejects work item creation by a VIEWER with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`)
      .send({
        title: 'Viewer Attempting Creation',
        description: 'Should be rejected server-side',
        teamId: ctx.platformTeam.id
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  it('rejects cross-team access when a user is not a member of that team', async () => {
    // Eve is only member of Customer Escalations, NOT Platform Operations
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.eveExternal.token}`)
      .send({
        title: 'Eve Invading Platform Team',
        description: 'Should be blocked with 403',
        teamId: ctx.platformTeam.id
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden: You are not a member of this team/i);
  });

  it('allows MEMBER to create item and VIEWER to read item in their team', async () => {
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        title: 'Valid Member Created Item',
        description: 'Should succeed and return 201',
        teamId: ctx.platformTeam.id
      });

    expect(createRes.status).toBe(201);
    const itemId = createRes.body.id;

    // Victor Viewer can read it
    const readRes = await request(app)
      .get(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.title).toBe('Valid Member Created Item');

    // Eve External cannot read it
    const crossReadRes = await request(app)
      .get(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.eveExternal.token}`);

    expect(crossReadRes.status).toBe(403);
  });

  it('rejects claim, edit, and comment mutations by a VIEWER with 403 Forbidden', async () => {
    // Member creates an item
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        title: 'Work Item For Mutation Checks',
        description: 'Testing viewer mutation blocking',
        teamId: ctx.platformTeam.id
      });
    const itemId = createRes.body.id;

    // 1. Viewer cannot claim
    const claimRes = await request(app)
      .post(`/api/items/${itemId}/claim`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`);
    expect(claimRes.status).toBe(403);
    expect(claimRes.body.error).toMatch(/requires at least MEMBER role/i);

    // 2. Viewer cannot edit
    const editRes = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`)
      .send({ version: 1, title: 'Viewer Attempting Edit' });
    expect(editRes.status).toBe(403);
    expect(editRes.body.error).toMatch(/requires at least MEMBER role/i);

    // 3. Viewer cannot comment
    const commentRes = await request(app)
      .post(`/api/items/${itemId}/comments`)
      .set('Authorization', `Bearer ${ctx.victorViewer.token}`)
      .send({ body: 'Viewer Attempting Comment' });
    expect(commentRes.status).toBe(403);
    expect(commentRes.body.error).toMatch(/requires at least MEMBER role/i);
  });

  it('rejects cross-team claim and comment attempts by non-members with 403 Forbidden', async () => {
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ctx.mayaMember.token}`)
      .send({
        title: 'Platform Item Guarded From Eve',
        description: 'Confidential platform task',
        teamId: ctx.platformTeam.id
      });
    const itemId = createRes.body.id;

    // Eve cannot claim platform item
    const claimRes = await request(app)
      .post(`/api/items/${itemId}/claim`)
      .set('Authorization', `Bearer ${ctx.eveExternal.token}`);
    expect(claimRes.status).toBe(403);
    expect(claimRes.body.error).toMatch(/Forbidden: You are not a member of this team/i);

    // Eve cannot comment on platform item
    const commentRes = await request(app)
      .post(`/api/items/${itemId}/comments`)
      .set('Authorization', `Bearer ${ctx.eveExternal.token}`)
      .send({ body: 'Eve eavesdropping comment' });
    expect(commentRes.status).toBe(403);
    expect(commentRes.body.error).toMatch(/Forbidden: You are not a member of this team/i);
  });
});
