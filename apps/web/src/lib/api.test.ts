import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiData, onSessionExpired, tokenStore } from './api';

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const session = (token: string) => ({ success: true, data: { user: { id: 'u1' }, accessToken: token, expiresIn: 900 } });
const expired = { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' } };

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('old-token');
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the access token as a Bearer header', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: { ok: true } }));
    await apiData('/api/dashboard');
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer old-token');
    expect(init?.credentials).toBe('include');
  });

  it('refreshes once and replays the request when the access token has expired', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, expired)) // original request
      .mockResolvedValueOnce(json(200, session('new-token'))) // POST /api/auth/refresh
      .mockResolvedValueOnce(json(200, { success: true, data: { total: 3 } })); // replay

    await expect(apiData('/api/dashboard')).resolves.toEqual({ total: 3 });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh');
    expect((fetchMock.mock.calls[2]![1]?.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
  });

  it('shares a single refresh between parallel requests (single-flight)', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/auth/refresh') {
        refreshCalls += 1;
        return json(200, session('new-token'));
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-token' ? json(200, { success: true, data: url }) : json(401, expired);
    });

    const results = await Promise.all([apiData('/api/tasks'), apiData('/api/projects'), apiData('/api/dashboard')]);
    expect(results).toEqual(['/api/tasks', '/api/projects', '/api/dashboard']);
    expect(refreshCalls).toBe(1);
  });

  it('announces an expired session when the refresh token is rejected', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    fetchMock
      .mockResolvedValueOnce(json(401, expired))
      .mockResolvedValueOnce(json(401, { success: false, error: { code: 'REFRESH_TOKEN_INVALID', message: 'Your session has expired. Please log in again.' } }));

    await expect(apiData('/api/dashboard')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' });
    expect(listener).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
    unsubscribe();
  });

  it('does not end the session when refresh fails because the server is rate-limiting', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    fetchMock
      .mockResolvedValueOnce(json(401, expired))
      .mockResolvedValueOnce(json(429, { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }));

    await expect(apiData('/api/dashboard')).rejects.toMatchObject({ status: 429 });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('turns a failed fetch into a NETWORK_ERROR with a readable message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await apiData('/api/tasks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', isNetwork: true });
  });

  it('exposes field-level validation details from the API', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ path: 'name', message: 'Task name is required' }] } }),
    );
    await expect(apiData('/api/tasks', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      details: [{ path: 'name', message: 'Task name is required' }],
    });
  });
});
