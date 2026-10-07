import NetInfo from '@react-native-community/netinfo';
import {
  CLIENT_HEADER,
  MOBILE_CLIENT,
  type ApiErrorCode,
  type ApiErrorDetail,
  type ApiFailure,
  type AuthSession,
  type PaginationMeta,
  type User,
} from '@pms/shared';
import * as SecureStore from 'expo-secure-store';

/**
 * HTTP client for the Android app. Same API, same endpoints as the web app.
 *
 * Token storage: expo-secure-store, which encrypts values with a key held in the
 * Android Keystore (iOS: Keychain). Never AsyncStorage, which is plain text on disk.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000').replace(/\/$/, '');
/** Optional: the web app's address, used to link admins to the web Admin page. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/$/, '') || null;
// Free hosting tiers can take ~50 s to wake from sleep; allow for it rather than failing the first request.
const TIMEOUT_MS = 45_000;

const KEYS = { access: 'pms.accessToken', refresh: 'pms.refreshToken', user: 'pms.user' } as const;

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

  get endsSession() {
    return this.status === 401 || this.status === 403;
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<void> | null = null;
const sessionExpiredListeners = new Set<() => void>();

export const onSessionExpired = (listener: () => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

/** Secure persistence of the session. */
export const sessionStore = {
  async load(): Promise<User | null> {
    const [access, refresh, user] = await Promise.all([
      SecureStore.getItemAsync(KEYS.access),
      SecureStore.getItemAsync(KEYS.refresh),
      SecureStore.getItemAsync(KEYS.user),
    ]);
    if (!refresh || !user) return null;
    accessToken = access;
    refreshToken = refresh;
    try {
      return JSON.parse(user) as User;
    } catch {
      return null;
    }
  },

  async save(session: AuthSession) {
    accessToken = session.accessToken;
    refreshToken = session.refreshToken ?? refreshToken;
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, session.accessToken),
      refreshToken ? SecureStore.setItemAsync(KEYS.refresh, refreshToken) : Promise.resolve(),
      SecureStore.setItemAsync(KEYS.user, JSON.stringify(session.user)),
    ]);
  },

  /** Updates only the stored profile (e.g. after the role changed on the server). */
  async saveUser(user: User) {
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
  },

  getRefreshToken: () => refreshToken,
};

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  auth?: boolean;
  retried?: boolean;
}

const buildUrl = (path: string, query?: Query) => {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${API_URL}${path}${params ? `?${params}` : ''}`;
};

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', [CLIENT_HEADER]: MOBILE_CLIENT };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Please try again.');
    const net = await NetInfo.fetch().catch(() => null);
    const offline = net?.isConnected === false || net?.isInternetReachable === false;
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

async function doRefresh(): Promise<void> {
  if (!refreshToken) throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Your session has expired. Please log in again.');
  const res = await send('/api/auth/refresh', { method: 'POST', auth: false, body: { refreshToken } });
  if (!res.ok) throw await toError(res);
  await sessionStore.save(((await res.json()) as { data: AuthSession }).data);
}

/** Single-flight: screens that load in parallel share one refresh, so the rotating token is used once. */
const refresh = () => {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const res = await send(path, options);
  if (res.status !== 401 || options.retried || options.auth === false) return res;

  try {
    await refresh();
  } catch (error) {
    if (error instanceof ApiError && error.endsSession) {
      await sessionStore.clear();
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

export async function authRequest(path: '/api/auth/login' | '/api/auth/register', body: unknown): Promise<AuthSession> {
  const res = await send(path, { method: 'POST', body, auth: false });
  if (!res.ok) throw await toError(res);
  return ((await res.json()) as { data: AuthSession }).data;
}

/** Best effort: the local session is cleared even if the server cannot be reached. */
export async function logoutRequest(): Promise<void> {
  if (!refreshToken) return;
  await send('/api/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => undefined);
}

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
