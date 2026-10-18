import { OutboxWorker } from './worker.js';
import { prisma } from '../db.js';

const worker = new OutboxWorker();

console.log('[Worker Process] Initializing background outbox worker...');
worker.start();

const shutdown = async (signal: string) => {
  console.log(`[Worker Process] Received ${signal}. Shutting down gracefully...`);
  worker.stop();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
