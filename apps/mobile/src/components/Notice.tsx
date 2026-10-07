import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { radius, space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

export function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const c = tone === 'error' ? { fg: colors.danger, bg: colors.dangerSoft } : { fg: colors.progress, bg: colors.progressSoft };
  return (
    <View style={[styles.box, { backgroundColor: c.bg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Feather name={tone === 'error' ? 'alert-circle' : 'clock'} size={16} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  box: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, marginBottom: space.lg },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
}));
