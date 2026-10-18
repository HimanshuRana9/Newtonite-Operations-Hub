import { app } from './app.js';
import { env } from './env.js';
import { prisma } from './db.js';

const server = app.listen(env.PORT, () => {
  console.log(`[Newtonite Server] Running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`[Newtonite Server] Received ${signal}, closing server...`);
  server.close(async () => {
    console.log('[Newtonite Server] HTTP server closed. Disconnecting database...');
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
