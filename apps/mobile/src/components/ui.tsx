import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { radius, space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

type IconName = ComponentProps<typeof Feather>['name'];

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'secondary', icon, loading, disabled, style, accessibilityHint }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surface, pressed: colors.sunken, fg: colors.ink, border: colors.lineStrong },
    danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.lineStrong },
    ghost: { bg: 'transparent', pressed: colors.sunken, fg: colors.ink2, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border, opacity: inactive ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : icon ? <Feather name={icon} size={17} color={palette.fg} /> : null}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export function TextField({ label, error, hint, optional, style, ...props }: FieldProps) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={text.label}>
        {label}
        {optional ? <Text style={{ color: colors.faint, fontWeight: '400' }}> (optional)</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        style={[styles.input, error ? { borderColor: colors.danger } : null, props.multiline ? styles.multiline : null, style]}
        {...props}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={text.small}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  const { text } = useTheme();
  return <Text style={[text.label, { marginBottom: space.sm }]}>{children}</Text>;
}

/** Single-choice chips — the native-feeling control for status / priority / filters. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
  scroll = false,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  scroll?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.chips, scroll && { flexWrap: 'nowrap' }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}: ${option.label}`}
            style={({ pressed }) => [
              styles.chip,
              selected && { backgroundColor: colors.inverse, borderColor: colors.inverse },
              pressed && !selected && { backgroundColor: colors.sunken },
            ]}
          >
            {option.color ? <View style={[styles.dot, { backgroundColor: selected ? colors.onInverse : option.color }]} /> : null}
            <Text style={[styles.chipLabel, selected && { color: colors.onInverse }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const styles = useStyles();
  const { text } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={text.heading} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function ProgressBar({ done, total, suffix }: { done: number; total: number; suffix?: string }) {
  const styles = useStyles();
  const { text } = useTheme();
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={styles.progressRow} accessible accessibilityLabel={`${done} of ${total} tasks completed`}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={[text.small, { fontVariant: ['tabular-nums'] }]}>
        {done}/{total}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={20} color={colors.muted} />
      </View>
      <Text style={[text.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[text.small, styles.stateText]}>{description}</Text>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  button: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  field: { gap: 6 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  error: { fontSize: 13, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: { fontSize: 14, fontWeight: '500', color: colors.ink2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.done },
  state: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: 48 },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  stateText: { textAlign: 'center', marginTop: 4, maxWidth: 300 },
}));
