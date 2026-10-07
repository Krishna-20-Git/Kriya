import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatCalendarDate, todayLocal } from '@pms/shared';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { radius, space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

const toDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** Opens the platform's native date picker. Value is a YYYY-MM-DD string, or '' for no date. */
export function DateField({
  label,
  value,
  onChange,
  error,
  optional = true,
  placeholder = 'No due date',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const [open, setOpen] = useState(false);

  // onValueChange / onDismiss replace the deprecated onChange (datetimepicker 9.x).
  const onPick = (_event: unknown, date: Date) => {
    setOpen(Platform.OS === 'ios');
    onChange(todayLocal(date));
  };
  const onDismiss = () => setOpen(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={text.label}>
        {label}
        {optional ? <Text style={{ color: colors.faint, fontWeight: '400' }}> (optional)</Text> : null}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatCalendarDate(value) : 'not set'}`}
          accessibilityHint="Opens a date picker"
          style={[styles.input, error ? { borderColor: colors.danger } : null]}
        >
          <Feather name="calendar" size={16} color={colors.muted} />
          <Text style={{ fontSize: 16, color: value ? colors.ink : colors.faint }}>{value ? formatCalendarDate(value) : placeholder}</Text>
        </Pressable>
        {value && optional ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={`Clear ${label}`} style={styles.clear}>
            <Feather name="x" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ fontSize: 13, color: colors.danger }}>{error}</Text> : null}
      {open ? <DateTimePicker value={value ? toDate(value) : new Date()} mode="date" onValueChange={onPick} onDismiss={onDismiss} /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
  },
  clear: {
    width: 46,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
}));
