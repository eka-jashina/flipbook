import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { disconnectPrisma } from './utils/prisma.js';

// Load configuration from environment
const config = loadConfig();

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    'Flipbook server started',
  );
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully...');

  server.close(async () => {
    await disconnectPrisma();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
