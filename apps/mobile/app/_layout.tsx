import type { Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { PERSISTED_QUERY_ROOTS, persister, queryClient } from '../src/lib/query-client';
import { ThemeProvider, useTheme } from '../src/lib/theme-context';

// Keep the native splash screen up until the stored session has been read from SecureStore.
void SplashScreen.preventAutoHideAsync();

/** Gives React Navigation (headers, tab bar, screen backgrounds) the app's palette, and sets the status bar. */
function ThemedNavigation({ children }: { children: ReactNode }) {
  const { scheme, colors } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.accent, background: colors.paper, card: colors.surface, text: colors.ink, border: colors.line, notification: colors.danger },
    };
  }, [scheme, colors]);
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </NavigationThemeProvider>
  );
}

function RootNavigator() {
  const { colors } = useTheme();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  const signedIn = status === 'authenticated';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      {/* Protected routes: the signed-in area is unreachable without a session, and vice versa. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          dehydrateOptions: {
            // Only project/task data is cached for offline viewing; failed or pending queries are not.
            shouldDehydrateQuery: (query: Query) =>
              query.state.status === 'success' && PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
          },
        }}
      >
        <ThemeProvider>
          <ThemedNavigation>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemedNavigation>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
