import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/server/db.js';
import { resetAndSeedDatabase } from './helpers.js';
import { OutboxWorker } from '../src/server/worker/worker.js';
import { OutboxStatus } from '@prisma/client';

describe('Transactional Outbox Worker & Recovery', () => {
  let worker: OutboxWorker;

  beforeEach(async () => {
    await resetAndSeedDatabase();
    worker = new OutboxWorker({ leaseSeconds: 2, maxAttempts: 3 });
  });

  it('processes pending outbox event and generates notification', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: 'WORK_ITEM_CREATED',
        payload: {
          title: 'Test Urgent Item',
          toStatus: 'OPEN'
        },
        status: OutboxStatus.PENDING
      }
    });

    const processedCount = await worker.processBatch();
    expect(processedCount).toBeGreaterThanOrEqual(1);

    const updatedEvent = await prisma.outboxEvent.findUnique({
      where: { id: event.id }
    });
    expect(updatedEvent?.status).toBe(OutboxStatus.DONE);
    expect(updatedEvent?.processedAt).toBeDefined();

    // Verify idempotent notification created
    const notification = await prisma.notification.findUnique({
      where: { outboxEventId: event.id }
    });
    expect(notification).toBeDefined();
    expect(notification?.title).toMatch(/Test Urgent Item/);
  });

  it('recovers abandoned jobs when worker lease has expired', async () => {
    // Simulate a job abandoned 10 seconds ago by a crashed worker
    const pastLease = new Date(Date.now() - 10000);
    const abandonedEvent = await prisma.outboxEvent.create({
      data: {
        eventType: 'WORK_ITEM_CLAIMED',
        payload: {
          title: 'Abandoned In-Flight Operation',
          toStatus: 'IN_PROGRESS'
        },
        status: OutboxStatus.PROCESSING,
        leaseUntil: pastLease,
        attempts: 1
      }
    });

    // Worker batch should reclaim the abandoned event
    const count = await worker.processBatch();
    expect(count).toBeGreaterThanOrEqual(1);

    const reclaimed = await prisma.outboxEvent.findUnique({
      where: { id: abandonedEvent.id }
    });
    expect(reclaimed?.status).toBe(OutboxStatus.DONE);
    expect(reclaimed?.attempts).toBe(2);
  });

  it('retries failed jobs and marks permanently failed jobs as FAILED after max attempts', async () => {
    // Create an event that deterministically simulates failure
    const failingEvent = await prisma.outboxEvent.create({
      data: {
        eventType: 'WORK_ITEM_FAULT',
        payload: {
          _simulateError: 'Database connection dropped during notification dispatch'
        },
        status: OutboxStatus.PENDING,
        attempts: 2,
        maxAttempts: 3
      }
    });

    await worker.processBatch();

    const result = await prisma.outboxEvent.findUnique({
      where: { id: failingEvent.id }
    });

    expect(result?.status).toBe(OutboxStatus.FAILED);
    expect(result?.lastError).toMatch(/Injected failure for testing/);
  });

  it('guarantees duplicate dispatch is idempotent and does not create duplicate notifications', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: 'WORK_ITEM_DUPLICATE_CHECK',
        payload: {
          title: 'Idempotent Dispatch Verification'
        },
        status: OutboxStatus.PENDING
      }
    });

    // First dispatch
    await worker.handleSingleEvent(event);
    // Second duplicate dispatch (simulating worker crash right before marking DONE)
    await worker.handleSingleEvent(event);

    const notifications = await prisma.notification.findMany({
      where: { outboxEventId: event.id }
    });
    expect(notifications.length).toBe(1);
  });
});
