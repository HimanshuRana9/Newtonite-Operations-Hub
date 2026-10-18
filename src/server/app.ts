import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { authRouter } from './auth/auth.routes.js';
import { teamRouter } from './teams/team.routes.js';
import { itemRouter } from './items/item.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  }));

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'newtonite-operations-hub',
      timestamp: new Date().toISOString()
    });
  });

  // API Route mounting
  app.use('/api/auth', authRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/items', itemRouter);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
