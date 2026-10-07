import type { ApiErrorCode, ApiErrorDetail, ApiFailure, AuthSession, PaginationMeta } from '@pms/shared';

/**
 * HTTP client for the web app.
 *
 * - The access token lives only in memory (never localStorage), so an XSS bug cannot read it from storage.
 * - The refresh token is an HttpOnly cookie the browser sends to /api/auth/refresh by itself.
 * - On 401 the client refreshes once (single-flight: parallel requests share one refresh) and retries.
 * - If refresh fails the session is over: listeners are told so the app can redirect to /login.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 20_000;

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ClientErrorCode,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  /** Only a 401/403 from the refresh endpoint means the session is really over. 429, 5xx and network errors are transient. */
  get endsSession() {
    return this.status === 401 || this.status === 403;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;
const sessionExpiredListeners = new Set<() => void>();

export const tokenStore = {
  set: (token: string | null) => {
    accessToken = token;
  },
  get: () => accessToken,
};

export const onSessionExpired = (listener: () => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Internal: prevents infinite refresh loops. */
  retried?: boolean;
  auth?: boolean;
}

const buildUrl = (path: string, query?: Query) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
};

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Please try again.');
    }
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      offline ? 'No internet connection. Check your connection and try again.' : 'Unable to connect to the server. Please try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiFailure | null;
  if (body?.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  return new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

/** POST /api/auth/refresh with the cookie. Retries once on REFRESH_CONFLICT (another tab rotated the token first). */
async function doRefresh(): Promise<AuthSession> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await send('/api/auth/refresh', { method: 'POST', auth: false });
    if (res.ok) {
      const session = ((await res.json()) as { data: AuthSession }).data;
      accessToken = session.accessToken;
      return session;
    }
    const error = await toError(res);
    if (error.code !== 'REFRESH_CONFLICT' || attempt === 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Your session has expired. Please log in again.');
}

export function refreshSession(): Promise<AuthSession> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const res = await send(path, options);
  if (res.status !== 401 || options.retried || options.auth === false) return res;

  // Access token missing or expired: refresh once, then replay the original request.
  try {
    await refreshSession();
  } catch (error) {
    if (error instanceof ApiError && error.endsSession) {
      accessToken = null;
      sessionExpiredListeners.forEach((listener) => listener());
    }
    throw error;
  }
  return send(path, { ...options, retried: true });
}

export async function apiData<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await request(path, options);
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return ((await res.json()) as { data: T }).data;
}

export async function apiPage<T>(path: string, options?: RequestOptions): Promise<{ items: T[]; meta: PaginationMeta }> {
  const res = await request(path, options);
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as { data: T[]; meta: PaginationMeta };
  return { items: body.data, meta: body.meta };
}

/** Unauthenticated auth calls (login/register/logout) do not trigger the refresh-and-retry logic. */
export async function authCall<T>(path: string, body?: unknown): Promise<T> {
  const res = await send(path, { method: 'POST', body, auth: false });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return ((await res.json()) as { data: T }).data;
}

/** A user-facing message for any error thrown by the client. */
export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
