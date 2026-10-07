import type { ApiFailure } from '@pms/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

interface PostgresError extends Error {
  code?: string;
}

const send = (res: Response, req: Request, status: number, error: Omit<ApiFailure['error'], 'requestId'>) => {
  const body: ApiFailure = { success: false, error: { ...error, requestId: String(req.id ?? '') || undefined } };
  res.status(status).json(body);
};

/**
 * Single place that turns exceptions into HTTP responses. Known errors keep their
 * message; anything unexpected is logged with its stack and returned as a generic 500
 * so internals (SQL, stack traces, file paths) never reach the client.
 */
export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    req.log?.error({ err: error }, 'Error after response was sent');
    return;
  }

  if (error instanceof AppError) {
    return send(res, req, error.status, { code: error.code, message: error.message, details: error.details });
  }

  if (error instanceof ZodError) {
    return send(res, req, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    });
  }

  const bodyError = error as BodyParserError;
  if (bodyError?.type === 'entity.parse.failed') {
    return send(res, req, 400, { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' });
  }
  if (bodyError?.type === 'entity.too.large') {
    return send(res, req, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
  }

  // Unique violation that slipped past an application-level check (e.g. two concurrent registrations).
  if ((error as PostgresError)?.code === '23505') {
    return send(res, req, 409, { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' });
  }

  (req.log ?? logger).error({ err: error }, 'Unhandled error');
  return send(res, req, 500, { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
}

export function notFoundMiddleware(req: Request, res: Response) {
  send(res, req, 404, { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
}
