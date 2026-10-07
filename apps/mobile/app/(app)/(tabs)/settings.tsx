import { Feather } from '@expo/vector-icons';
import { USER_ROLE_LABELS, formatTimestamp } from '@pms/shared';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { OfflineBanner } from '../../../src/components/states';
import { Button, Card, SectionHeader } from '../../../src/components/ui';
import { API_URL, WEB_URL } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth';
import { REMINDER_HOUR, UNAVAILABLE_MESSAGE, isExpoGo } from '../../../src/lib/notifications';
import { useReminders } from '../../../src/lib/reminders';
import { radius, space } from '../../../src/lib/theme';
import { makeStyles, useTheme, type ThemePreference } from '../../../src/lib/theme-context';

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  const { text } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={text.small}>{label}</Text>
      <Text style={styles.value} selectable>
        {value}
      </Text>
    </View>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: 'sun' | 'moon' | 'smartphone' }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'smartphone' },
];

/** Segmented Light / Dark / System control. The choice is saved on this device. */
function ThemeSwitch() {
  const styles = useStyles();
  const { colors, preference, setPreference } = useTheme();
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {THEME_OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setPreference(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} theme`}
            style={[styles.segmentItem, selected && styles.segmentSelected]}
          >
            <Feather name={option.icon} size={15} color={selected ? colors.ink : colors.muted} />
            <Text style={[styles.segmentLabel, selected && { color: colors.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Due-tomorrow reminders: on/off, how they are delivered, and a test button for the demo. */
function RemindersCard() {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const { enabled, permission, mode, setEnabled, sendTest } = useReminders();
  const [busy, setBusy] = useState(false);
  const blocked = permission === 'denied';

  const toggle = async (next: boolean) => {
    setBusy(true);
    const ok = await setEnabled(next).finally(() => setBusy(false));
    if (!ok) {
      Alert.alert('Notifications are blocked', 'Allow notifications for this app in Android settings to get reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  const unavailable = mode === 'unavailable';
  const status = unavailable
    ? UNAVAILABLE_MESSAGE
    : blocked
      ? 'Notifications are blocked for this app.'
      : !enabled
        ? 'Off'
        : mode === 'push'
          ? 'Delivered by push, even when the app is closed.'
          : mode === 'local'
            ? `Scheduled on this phone${isExpoGo ? ' (Expo Go doesn’t support push)' : ''}. Updated whenever you open the app.`
            : 'Setting up…';

  return (
    <Card>
      <View style={styles.reminderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.value}>Due-tomorrow reminders</Text>
          <Text style={text.small}>A notification at {REMINDER_HOUR}:00 the evening before a task is due.</Text>
        </View>
        <Switch
          value={!!enabled && !blocked}
          onValueChange={(next) => void toggle(next)}
          disabled={busy || enabled === null || unavailable}
          accessibilityLabel="Due-tomorrow reminders"
          trackColor={{ false: colors.lineStrong, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
      <View style={styles.rule} />
      <View style={styles.row}>
        <Text style={[text.small, blocked && { color: colors.danger }]}>{status}</Text>
        {blocked ? (
          <Button
            label="Open Android settings"
            icon="settings"
            variant="ghost"
            onPress={() => void Linking.openSettings()}
            style={styles.inlineButton}
          />
        ) : enabled && !unavailable ? (
          <Button
            label="Send test notification"
            icon="bell"
            variant="ghost"
            onPress={() =>
              void sendTest().catch((error: unknown) =>
                Alert.alert('Could not send', error instanceof Error ? error.message : 'Please try again.'),
              )
            }
            style={styles.inlineButton}
          />
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Admins only. Role management lives on the web console by design (rare, high-risk, detail-heavy
 * work); this card makes that explicit and links straight to it.
 */
function AdminToolsCard() {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const open = () =>
    WEB_URL &&
    void Linking.openURL(`${WEB_URL}/admin`).catch(() =>
      Alert.alert('Could not open the browser', `Open ${WEB_URL}/admin on a computer instead.`),
    );

  return (
    <Card>
      <View style={styles.adminHead}>
        <View style={[styles.adminIcon, { backgroundColor: colors.accentSoft }]}>
          <Feather name="shield" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.value}>Admin tools</Text>
          <Text style={text.small}>Manage users and roles, and review the audit log, in the web app’s Admin page.</Text>
        </View>
      </View>
      <View style={styles.rule} />
      <View style={styles.row}>
        {WEB_URL ? (
          <Button label="Open Admin on the web" icon="external-link" variant="ghost" onPress={open} style={styles.inlineButton} />
        ) : (
          <Text style={text.small}>Sign in to the Kriya website on a computer and choose Admin in the sidebar.</Text>
        )}
      </View>
    </Card>
  );
}

export default function SettingsScreen() {
  const styles = useStyles();
  const { text } = useTheme();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'Saved data is removed from this device. You can sign in again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <SectionHeader title="Appearance" />
          <ThemeSwitch />
          <Text style={[text.small, { marginTop: space.sm }]}>System follows your phone’s light or dark setting.</Text>
        </View>

        <View>
          <SectionHeader title="Reminders" />
          <RemindersCard />
        </View>

        <View>
          <SectionHeader title="Profile" />
          <Card>
            <Row label="Full name" value={user?.fullName ?? ''} />
            <View style={styles.rule} />
            <Row label="Email" value={user?.email ?? ''} />
            <View style={styles.rule} />
            {/* Sessions saved before roles existed have no role yet; they are regular users. */}
            <Row label="Role" value={USER_ROLE_LABELS[user?.role ?? 'USER']} />
            <View style={styles.rule} />
            <Row label="Member since" value={formatTimestamp(user?.createdAt)} />
          </Card>
        </View>

        {user?.role === 'ADMIN' ? (
          <View>
            <SectionHeader title="Administration" />
            <AdminToolsCard />
          </View>
        ) : null}

        <View>
          <SectionHeader title="Connection" />
          <Card>
            {/* Shown so the demo can prove web and mobile use the same backend. */}
            <Row label="API server" value={API_URL} />
            <View style={styles.rule} />
            <Row label="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          </Card>
          <Text style={[text.small, { marginTop: space.sm }]}>
            Your sign-in is stored in the device’s secure storage (Android Keystore).
          </Text>
        </View>

        <Button label="Sign out" icon="log-out" variant="danger" onPress={confirmLogout} loading={signingOut} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { padding: space.lg, gap: space.xl },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  value: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: space.lg },
  segment: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
  },
  segmentSelected: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
  segmentLabel: { fontSize: 14, fontWeight: '500', color: colors.muted },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  adminHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  adminIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  inlineButton: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0, marginTop: space.xs },
}));
