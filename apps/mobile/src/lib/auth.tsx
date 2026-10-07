import type { LoginInput, RegisterInput, User } from '@pms/shared';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { apiData, authRequest, logoutRequest, onSessionExpired, sessionStore } from './api';
import { clearReminders, unregisterPush } from './notifications';
import { clearCachedData } from './query-client';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  sessionExpired: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Restore the session from SecureStore. No network call is needed, so the app opens offline
  // with cached data; an expired access token is refreshed on the first API request.
  useEffect(() => {
    sessionStore
      .load()
      .then((stored) => {
        setUser(stored);
        setStatus(stored ? 'authenticated' : 'anonymous');
      })
      .catch(() => setStatus('anonymous'));
  }, []);

  const end = useCallback(async (expired: boolean) => {
    await sessionStore.clear();
    await clearCachedData(); // the next person to sign in must never see this user's cached tasks
    await clearReminders(); // and must never get this user's reminders
    setUser(null);
    setSessionExpired(expired);
    setStatus('anonymous');
  }, []);

  // The API client reports a refresh token that was rejected (expired, revoked, signed out everywhere).
  useEffect(() => onSessionExpired(() => void end(true)), [end]);

  // Re-read the profile when the app opens or returns to the foreground, so a role changed by an
  // admin (or a renamed account) shows up without signing out. Offline: the stored copy is kept.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sync = () =>
      apiData<User>('/api/auth/me')
        .then(async (fresh) => {
          setUser(fresh);
          await sessionStore.saveUser(fresh);
        })
        .catch(() => undefined);
    void sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => sub.remove();
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      login: async (input) => {
        const session = await authRequest('/api/auth/login', input);
        await clearCachedData();
        await sessionStore.save(session);
        setUser(session.user);
        setSessionExpired(false);
        setStatus('authenticated');
      },
      register: async (input) => {
        const session = await authRequest('/api/auth/register', input);
        await clearCachedData();
        await sessionStore.save(session);
        setUser(session.user);
        setSessionExpired(false);
        setStatus('authenticated');
      },
      logout: async () => {
        await unregisterPush(); // while the session is still valid, so the server stops pushing to this phone
        await logoutRequest();
        await end(false);
      },
    }),
    [status, user, sessionExpired, end],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
