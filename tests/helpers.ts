import { prisma } from '../src/server/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../src/server/env.js';

export interface TestContext {
  platformTeam: { id: string; name: string };
  escalationsTeam: { id: string; name: string };
  aliceAdmin: { id: string; email: string; token: string };
  leoLead: { id: string; email: string; token: string };
  mayaMember: { id: string; email: string; token: string };
  victorViewer: { id: string; email: string; token: string };
  eveExternal: { id: string; email: string; token: string };
}

export async function resetAndSeedDatabase(): Promise<TestContext> {
  // Clear tables
  await prisma.notification.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [alice, leo, maya, victor, eve] = await Promise.all([
    prisma.user.create({
      data: { name: 'Alice Admin', email: 'alice@test.io', passwordHash, active: true }
    }),
    prisma.user.create({
      data: { name: 'Leo Lead', email: 'leo@test.io', passwordHash, active: true }
    }),
    prisma.user.create({
      data: { name: 'Maya Member', email: 'maya@test.io', passwordHash, active: true }
    }),
    prisma.user.create({
      data: { name: 'Victor Viewer', email: 'victor@test.io', passwordHash, active: true }
    }),
    prisma.user.create({
      data: { name: 'Eve External', email: 'eve@test.io', passwordHash, active: true }
    })
  ]);

  const platformTeam = await prisma.team.create({
    data: { name: 'Platform Operations' }
  });

  const escalationsTeam = await prisma.team.create({
    data: { name: 'Customer Escalations' }
  });

  await prisma.membership.createMany({
    data: [
      { userId: alice.id, teamId: platformTeam.id, role: Role.ADMIN },
      { userId: leo.id, teamId: platformTeam.id, role: Role.LEAD },
      { userId: maya.id, teamId: platformTeam.id, role: Role.MEMBER },
      { userId: victor.id, teamId: platformTeam.id, role: Role.VIEWER },

      { userId: eve.id, teamId: escalationsTeam.id, role: Role.MEMBER }
    ]
  });

  const sign = (user: { id: string; email: string; name: string }) =>
    jwt.sign({ userId: user.id, email: user.email, name: user.name }, env.JWT_SECRET, { expiresIn: '1h' });

  return {
    platformTeam,
    escalationsTeam,
    aliceAdmin: { id: alice.id, email: alice.email, token: sign(alice) },
    leoLead: { id: leo.id, email: leo.email, token: sign(leo) },
    mayaMember: { id: maya.id, email: maya.email, token: sign(maya) },
    victorViewer: { id: victor.id, email: victor.email, token: sign(victor) },
    eveExternal: { id: eve.id, email: eve.email, token: sign(eve) }
  };
}
