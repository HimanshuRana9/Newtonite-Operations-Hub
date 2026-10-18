import { PrismaClient, Role, WorkItemType, Priority, WorkItemStatus, ActivityEventType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seed() {
  console.log('Seeding Newtonite Operations Hub database...');

  // Clean existing records in correct dependency order
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

  // 1. Seed Users
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Admin',
      email: 'admin@newtonite.io',
      passwordHash,
      active: true
    }
  });

  const leo = await prisma.user.create({
    data: {
      name: 'Leo Lead',
      email: 'lead@newtonite.io',
      passwordHash,
      active: true
    }
  });

  const maya = await prisma.user.create({
    data: {
      name: 'Maya Member',
      email: 'member@newtonite.io',
      passwordHash,
      active: true
    }
  });

  const victor = await prisma.user.create({
    data: {
      name: 'Victor Viewer',
      email: 'viewer@newtonite.io',
      passwordHash,
      active: true
    }
  });

  const eve = await prisma.user.create({
    data: {
      name: 'Eve External',
      email: 'extern@newtonite.io',
      passwordHash,
      active: true
    }
  });

  console.log('Created users: Alice (Admin), Leo (Lead), Maya (Member), Victor (Viewer), Eve (External)');

  // 2. Seed Teams
  const platformTeam = await prisma.team.create({
    data: {
      name: 'Platform Core Operations'
    }
  });

  const escalationsTeam = await prisma.team.create({
    data: {
      name: 'Customer Response & Escalations'
    }
  });

  console.log('Created teams: Platform Core Operations, Customer Response & Escalations');

  // 3. Seed Memberships
  await prisma.membership.createMany({
    data: [
      { userId: alice.id, teamId: platformTeam.id, role: Role.ADMIN },
      { userId: leo.id, teamId: platformTeam.id, role: Role.LEAD },
      { userId: maya.id, teamId: platformTeam.id, role: Role.MEMBER },
      { userId: victor.id, teamId: platformTeam.id, role: Role.VIEWER },

      { userId: eve.id, teamId: escalationsTeam.id, role: Role.MEMBER },
      { userId: alice.id, teamId: escalationsTeam.id, role: Role.ADMIN }
    ]
  });

  // 4. Seed Work Items in Platform Core Operations
  const item1 = await prisma.workItem.create({
    data: {
      title: 'Critical API Gateway memory leak under sustained load',
      description: 'Ingress proxies report rapid heap growth and pod evictions when RPS exceeds 12,000. Needs immediate investigation.',
      type: WorkItemType.INCIDENT,
      priority: Priority.URGENT,
      status: WorkItemStatus.OPEN,
      teamId: platformTeam.id,
      creatorId: alice.id,
      assigneeId: null,
      version: 1,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  await prisma.activityEvent.create({
    data: {
      workItemId: item1.id,
      actorId: alice.id,
      eventType: ActivityEventType.CREATED,
      metadata: { initialPriority: Priority.URGENT, initialStatus: WorkItemStatus.OPEN }
    }
  });

  const item2 = await prisma.workItem.create({
    data: {
      title: 'Database connection pool exhaustion mitigation',
      description: 'Increase pool bounds and configure idle timeout eviction to prevent client connection timeouts during traffic spikes.',
      type: WorkItemType.BUG,
      priority: Priority.HIGH,
      status: WorkItemStatus.IN_PROGRESS,
      teamId: platformTeam.id,
      creatorId: leo.id,
      assigneeId: maya.id,
      version: 2
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        workItemId: item2.id,
        actorId: leo.id,
        eventType: ActivityEventType.CREATED,
        metadata: { title: item2.title }
      },
      {
        workItemId: item2.id,
        actorId: maya.id,
        eventType: ActivityEventType.CLAIMED,
        metadata: { previousStatus: WorkItemStatus.OPEN, newStatus: WorkItemStatus.IN_PROGRESS }
      }
    ]
  });

  await prisma.comment.create({
    data: {
      workItemId: item2.id,
      authorId: maya.id,
      body: 'Investigating query response percentiles. PgBouncer pool sizing adjustments are in progress.'
    }
  });

  const item3 = await prisma.workItem.create({
    data: {
      title: 'Outbox event table automated vacuuming policy',
      description: 'Prepare automated vacuuming and partitioning migration for outbox_events to sustain 5M records/day throughput.',
      type: WorkItemType.TASK,
      priority: Priority.HIGH,
      status: WorkItemStatus.AWAITING_APPROVAL,
      teamId: platformTeam.id,
      creatorId: maya.id,
      assigneeId: maya.id,
      version: 3
    }
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        workItemId: item3.id,
        actorId: maya.id,
        eventType: ActivityEventType.CREATED,
        metadata: {}
      },
      {
        workItemId: item3.id,
        actorId: maya.id,
        eventType: ActivityEventType.TRANSITIONED,
        metadata: { from: WorkItemStatus.IN_PROGRESS, to: WorkItemStatus.AWAITING_APPROVAL }
      }
    ]
  });

  const item4 = await prisma.workItem.create({
    data: {
      title: 'Implement rate limiting for authentication endpoints',
      description: 'Added sliding window rate limiting on /api/auth/login to thwart brute-force attempts.',
      type: WorkItemType.FEATURE,
      priority: Priority.MEDIUM,
      status: WorkItemStatus.RESOLVED,
      teamId: platformTeam.id,
      creatorId: leo.id,
      assigneeId: maya.id,
      version: 4
    }
  });

  const item5 = await prisma.workItem.create({
    data: {
      title: 'Rotate TLS certificates for ingress gateway',
      description: 'Annual certificate rotation completed across all cluster ingress points without downtime.',
      type: WorkItemType.TASK,
      priority: Priority.LOW,
      status: WorkItemStatus.CLOSED,
      teamId: platformTeam.id,
      creatorId: alice.id,
      assigneeId: leo.id,
      version: 5
    }
  });

  // Seed Outbox Event demonstration
  const outbox = await prisma.outboxEvent.create({
    data: {
      eventType: 'WORK_ITEM_URGENT_ALERT',
      payload: {
        workItemId: item1.id,
        title: item1.title,
        priority: item1.priority,
        teamName: platformTeam.name
      },
      status: 'PENDING'
    }
  });

  console.log(`Seeded demo items (${item1.id}, ${item2.id}, ${item3.id}, ${item4.id}, ${item5.id}) and outbox event ${outbox.id}`);
  console.log('Seeding completed successfully!');
}

if (process.argv[1]?.includes('seed.ts')) {
  seed()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
