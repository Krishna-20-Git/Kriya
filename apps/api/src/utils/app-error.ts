import type { ApiErrorCode, ApiErrorDetail } from '@pms/shared';

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const unauthenticated = (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message);

export const validationError = (message: string, details?: ApiErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message);
