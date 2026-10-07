import { Feather } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ApiError } from '../lib/api';
import { space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { Button } from './ui';

export function useIsOffline() {
  const net = useNetInfo();
  return net.isConnected === false || net.isInternetReachable === false;
}

/** Thin banner shown on every signed-in screen while offline; cached data stays visible underneath. */
export function OfflineBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name="wifi-off" size={14} color={colors.onInverse} />
      <Text style={styles.bannerText}>No internet connection — showing saved data</Text>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const offline = useIsOffline();
  const network = error instanceof ApiError && error.isNetwork;
  const title = offline ? 'No internet connection' : network ? 'Unable to connect to the server' : "This couldn't be loaded";
  const description = offline
    ? 'Check your connection and try again.'
    : network
      ? 'The server didn’t respond. It may be starting up — try again in a moment.'
      : error instanceof ApiError
        ? error.message
        : 'Something went wrong. Please try again.';
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: colors.dangerSoft }]}>
        <Feather name={network || offline ? 'wifi-off' : 'alert-triangle'} size={20} color={colors.danger} />
      </View>
      <Text style={[text.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[text.small, { textAlign: 'center', marginTop: 4, maxWidth: 300 }]}>{description}</Text>
      <Button label="Retry" icon="rotate-cw" onPress={onRetry} style={{ marginTop: space.lg }} />
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/**
 * Renders the right state for a query: data (including cached data while offline),
 * loading, "offline with nothing cached", or an error with Retry. Never a blank screen.
 */
export function QueryView<T>({ query, children }: { query: Pick<UseQueryResult<T>, 'data' | 'error' | 'isPending' | 'fetchStatus' | 'refetch'>; children: (data: T) => ReactNode }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;
  // Offline and nothing in the cache: TanStack Query pauses the request instead of failing it.
  if (query.isPending && query.fetchStatus === 'paused') {
    return <ErrorView error={new ApiError(0, 'NETWORK_ERROR', 'No internet connection')} onRetry={() => void query.refetch()} />;
  }
  return <Loading />;
}

const useStyles = makeStyles((colors) => ({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.inverse, paddingVertical: 6 },
  bannerText: { color: colors.onInverse, fontSize: 13, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 280 },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
}));
