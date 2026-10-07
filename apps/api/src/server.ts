import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { startReminderScheduler } from './services/notification.service.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV, webOrigins: env.WEB_ORIGINS }, 'API listening');
  if (env.REMINDER_SCHEDULER) startReminderScheduler();
});

/** Stop accepting connections, let in-flight requests finish, then close the DB pool. */
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
