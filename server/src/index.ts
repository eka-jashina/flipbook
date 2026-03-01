import * as Sentry from '@sentry/node';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { disconnectPrisma } from './utils/prisma.js';

// Load configuration from environment
const config = loadConfig();

// Initialize Sentry (only if DSN is configured)
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  logger.info('Sentry initialized');
}

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

// Catch unhandled errors so they are logged (not silently lost)
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  shutdown('uncaughtException');
});
