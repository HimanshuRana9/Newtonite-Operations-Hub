import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const databaseUrl =
  (process.env.NODE_ENV === 'test' && (process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL))
    ? (process.env.TEST_DATABASE_URL || env.TEST_DATABASE_URL)!
    : env.DATABASE_URL;

export const prisma =
  global.__prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
