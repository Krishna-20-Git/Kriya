import type { AuthSession, LoginInput, RegisterInput, User } from '@pms/shared';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiData, authCall, onSessionExpired, refreshSession, tokenStore } from '../lib/api';
import { queryClient } from '../lib/query-client';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  /** Set when the session ended on its own (not by the user), shown on the login screen. */
  sessionExpired: boolean;
  /** Set when restoring the session failed for a transient reason (offline, server down, rate-limited). */
  bootError: unknown;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  retryBoot: () => void;
  /** Re-reads the profile (including the role) from the server. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [bootError, setBootError] = useState<unknown>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  const startSession = useCallback((session: AuthSession) => {
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setSessionExpired(false);
    setStatus('authenticated');
  }, []);

  const endSession = useCallback((expired: boolean) => {
    tokenStore.set(null);
    queryClient.clear(); // never show the previous user's cached data to the next one
    setUser(null);
    setSessionExpired(expired);
    setStatus('anonymous');
  }, []);

  // On page load the access token is gone (memory only); the HttpOnly cookie restores the session.
  useEffect(() => {
    let cancelled = false;
    setBootError(null);
    refreshSession()
      .then((session) => !cancelled && startSession(session))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.endsSession) {
          // A cookie was present but is expired/revoked → tell the user; no cookie at all → plain login page.
          endSession(error.code === 'REFRESH_TOKEN_INVALID' || error.code === 'REFRESH_TOKEN_REUSED');
          return;
        }
        // Offline, rate-limited or server error: keep the cookie and offer a retry instead of logging out.
        setBootError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt, startSession, endSession]);

  useEffect(() => onSessionExpired(() => endSession(true)), [endSession]);

  /**
   * Keeps the profile current while the page is open. The API enforces roles on every request,
   * but the UI (e.g. the Admin link) uses this copy — so after an admin promotes or demotes this
   * user, the change shows up when the tab regains focus, within a minute, or on the next 403.
   */
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await apiData<User>('/api/auth/me');
      setUser((current) =>
        current && current.id === fresh.id && current.role === fresh.role && current.fullName === fresh.fullName && current.email === fresh.email ? current : fresh,
      );
    } catch {
      // Offline or session ending: the API client handles expiry; nothing to update.
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let last = Date.now();
    const sync = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10_000) return;
      last = Date.now();
      void refreshUser();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const timer = window.setInterval(sync, 60_000);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      window.clearInterval(timer);
    };
  }, [status, refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      bootError,
      login: async (input) => startSession(await authCall<AuthSession>('/api/auth/login', input)),
      register: async (input) => startSession(await authCall<AuthSession>('/api/auth/register', input)),
      logout: async () => {
        // Even if the network call fails, the local session is cleared.
        await authCall('/api/auth/logout').catch(() => undefined);
        endSession(false);
      },
      logoutEverywhere: async () => {
        // apiData (not authCall) so an expired access token is refreshed before revoking.
        await apiData<void>('/api/auth/logout-all', { method: 'POST' });
        endSession(false);
      },
      retryBoot: () => setBootAttempt((n) => n + 1),
      refreshUser,
    }),
    [status, user, sessionExpired, bootError, startSession, endSession, refreshUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
