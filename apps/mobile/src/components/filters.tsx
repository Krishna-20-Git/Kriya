import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

export interface Option<T extends string> {
  value: T;
  label: string;
  color?: string;
}

/** Search input with a leading icon and a clear button. */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.searchWrap}>
      <Feather name="search" size={16} color={colors.faint} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.search}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.searchClear}>
          <Feather name="x-circle" size={16} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A filter chip that shows its current value and opens a bottom sheet of options —
 * the Android "filter chip with menu" pattern. All filters stay visible in one row.
 */
export function SelectChip<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
  icon,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** The "no filter" value. When the value differs, the chip is highlighted. */
  defaultValue: T;
  icon?: 'sliders' | 'arrow-down' | 'filter';
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const active = value !== defaultValue;
  const shown = active ? current?.label ?? label : label;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'Any'}`}
        accessibilityHint="Opens options"
        style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && { backgroundColor: colors.sunken }]}
      >
        {icon ? <Feather name={icon} size={14} color={active ? colors.accent : colors.ink2} /> : null}
        {active && current?.color ? <View style={[styles.dot, { backgroundColor: current.color }]} /> : null}
        <Text style={[styles.chipLabel, active && { color: colors.accent }]} numberOfLines={1}>
          {shown}
        </Text>
        <Feather name="chevron-down" size={15} color={active ? colors.accent : colors.muted} />
      </Pressable>
      <OptionSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </>
  );
}

function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={[text.heading, styles.sheetTitle]} accessibilityRole="header">
          {title}
        </Text>
        <ScrollView>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.sunken }]}
              >
                {option.color ? <View style={[styles.dot, { backgroundColor: option.color }]} /> : null}
                <Text style={[styles.optionLabel, selected && { fontWeight: '600', color: colors.ink }]}>{option.label}</Text>
                {selected ? <Feather name="check" size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** One row: filter chips, then a "Clear" action when anything is filtered. Scrolls if the screen is narrow. */
export function FilterRow({ children, onClear, summary }: { children: React.ReactNode; onClear?: () => void; summary?: string }) {
  const styles = useStyles();
  const { text } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        {children}
        {onClear ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear filters" hitSlop={6} style={styles.clear}>
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {summary ? <Text style={text.small}>{summary}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: space.md, zIndex: 1 },
  searchClear: { position: 'absolute', right: space.md, zIndex: 1 },
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    paddingLeft: 36,
    paddingRight: 36,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: {
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipLabel: { fontSize: 14, fontWeight: '500', color: colors.ink2, maxWidth: 150 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  clear: { height: 34, justifyContent: 'center', paddingHorizontal: space.sm },
  clearLabel: { fontSize: 14, fontWeight: '600', color: colors.accent },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: space.sm },
  sheetTitle: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50, paddingHorizontal: space.lg },
  optionLabel: { flex: 1, fontSize: 16, color: colors.ink2 },
}));
