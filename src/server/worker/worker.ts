import { prisma } from '../db.js';
import { env } from '../env.js';
import { OutboxStatus } from '@prisma/client';

export interface WorkerOptions {
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
}

export class OutboxWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private batchSize: number;
  private leaseSeconds: number;
  private maxAttempts: number;

  constructor(options: WorkerOptions = {}) {
    this.batchSize = options.batchSize || 10;
    this.leaseSeconds = options.leaseSeconds || env.WORKER_LEASE_SECONDS || 30;
    this.maxAttempts = options.maxAttempts || env.WORKER_MAX_ATTEMPTS || 5;
  }

  public async start(intervalMs: number = env.WORKER_INTERVAL_MS || 2000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[OutboxWorker] Started (poll: ${intervalMs}ms, lease: ${this.leaseSeconds}s, maxAttempts: ${this.maxAttempts})`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err) {
        console.error('[OutboxWorker] Error during batch processing:', err);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, intervalMs);
        }
      }
    };

    poll();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[OutboxWorker] Stopped');
  }

  /**
   * Process a single batch of events atomically claiming them with FOR UPDATE SKIP LOCKED
   * and reclaiming abandoned jobs whose lease has expired.
   */
  public async processBatch(): Promise<number> {
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + this.leaseSeconds * 1000);

    // 1. Claim eligible jobs inside a transaction:
    // Eligible jobs are either:
    //   - status = 'PENDING'
    //   - status = 'PROCESSING' AND lease_until < NOW() (abandoned by crashed worker)
    // where attempts < max_attempts
    const claimedEvents: any[] = await prisma.$transaction(async (tx) => {
      const rows: any[] = await tx.$queryRaw`
        SELECT id, "eventType", payload, status, attempts, "maxAttempts"
        FROM outbox_events
        WHERE (
          status = 'PENDING'::"OutboxStatus"
          OR (status = 'PROCESSING'::"OutboxStatus" AND "leaseUntil" < ${now})
        )
        AND attempts < ${this.maxAttempts}
        ORDER BY "createdAt" ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED;
      `;

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);

      // Mark claimed jobs as PROCESSING with leaseUntil and increment attempts
      await tx.$executeRaw`
        UPDATE outbox_events
        SET status = 'PROCESSING'::"OutboxStatus",
            "leaseUntil" = ${leaseExpiry},
            attempts = attempts + 1
        WHERE id = ANY(${ids}::text[]);
      `;

      return rows;
    });

    if (claimedEvents.length === 0) {
      return 0;
    }

    // 2. Process each claimed event through its idempotent handler
    for (const event of claimedEvents) {
      await this.handleSingleEvent(event);
    }

    return claimedEvents.length;
  }

  /**
   * Dispatches and handles an individual event with error recording and idempotent handler.
   */
  public async handleSingleEvent(event: any): Promise<void> {
    try {
      // Execute the business side effect (idempotently)
      await this.dispatch(event);

      // Mark as completed
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.DONE,
          processedAt: new Date(),
          leaseUntil: null,
          lastError: null
        }
      });
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      console.error(`[OutboxWorker] Event ${event.id} failed:`, errorMessage);

      const attemptsSoFar = event.attempts + 1;
      const isFailedPermanently = attemptsSoFar >= (event.maxAttempts || this.maxAttempts);

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: isFailedPermanently ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          lastError: errorMessage,
          leaseUntil: null // release lease so it can be retried if pending
        }
      });
    }
  }

  /**
   * Idempotent event dispatcher: creates a unique notification record in PostgreSQL.
   * If a notification for this outboxEventId already exists (e.g. after a crash or retry),
   * the operation is safely skipped or upserted without duplication.
   */
  private async dispatch(event: any): Promise<void> {
    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;

    // Simulate potential failure if payload contains _simulateError for testing
    if (payload?._simulateError) {
      throw new Error(`Injected failure for testing: ${payload._simulateError}`);
    }

    let title = `System Alert: ${event.eventType}`;
    let message = `Event ${event.id} processed`;

    if (payload.title) {
      title = `Update on: ${payload.title}`;
    }
    if (payload.toStatus) {
      message = `Status changed to ${payload.toStatus}`;
    }

    // Upsert notification uniquely mapped to outboxEventId
    await prisma.notification.upsert({
      where: { outboxEventId: event.id },
      create: {
        outboxEventId: event.id,
        recipientId: payload.assigneeId || payload.actorId || null,
        title,
        message
      },
      update: {
        title,
        message
      }
    });
  }
}
