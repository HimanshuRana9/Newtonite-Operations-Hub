import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
dotenv.config();

// Direct tests to the test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres@localhost:5433/newtonite_test?schema=public';
process.env.NODE_ENV = 'test';

import { prisma } from '../src/server/db.js';

beforeAll(async () => {
  // Ensure database connection is healthy
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
