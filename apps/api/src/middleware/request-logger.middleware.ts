import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * One structured log line per request with a request ID (also returned in the
 * X-Request-Id header and in error bodies) so a user-reported error can be traced.
 * Bodies and auth headers are never logged.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      // Drop the query string: search terms are user content, not operational data.
      url: req.url.split('?')[0],
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
  autoLogging: { ignore: (req) => req.url === '/api/health' },
});
