import { pino } from 'pino';
import { env, isProduction, isTest } from '../config/env.js';

/**
 * Structured JSON logs in production; pretty logs in development; silent in tests.
 * Credentials are redacted at the logger level so a careless log call cannot leak them.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.accessToken',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(isProduction || isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
});
