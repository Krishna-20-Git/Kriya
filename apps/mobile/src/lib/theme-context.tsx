import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import { darkColors, lightColors, makePriorityColors, makeStatusColors, makeText, type Colors, type TextStyles } from './theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

/** A UI preference, not a secret, so AsyncStorage (not SecureStore). Logout does not clear it. */
const STORAGE_KEY = 'kriya-theme';

const build = (scheme: Scheme) => {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return { scheme, colors, text: makeText(colors), statusColors: makeStatusColors(colors), priorityColors: makePriorityColors(colors) };
};
// Built once per scheme so every consumer shares the same objects (stable for memoised styles).
const THEMES = { light: build('light'), dark: build('dark') } as const;
type Theme = (typeof THEMES)[Scheme];

interface ThemeContextValue extends Theme {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);
  const system = useColorScheme();

  // Read the saved choice before rendering anything, so a dark-mode user never sees a light frame.
  // The native splash screen stays up meanwhile (it is hidden by the root layout once auth is ready).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setPreferenceState(stored === 'light' || stored === 'dark' ? stored : 'system'))
      .catch(() => setPreferenceState('system'));
  }, []);

  // Tell React Native the app's scheme so native UI (date picker, alerts, keyboard) matches it.
  useEffect(() => {
    // Guarded: not every platform implements it (e.g. react-native-web), and the in-app palette works without it.
    if (preference && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    }
  }, [preference]);

  const scheme: Scheme = preference === 'light' || preference === 'dark' ? preference : system === 'dark' ? 'dark' : 'light';
  const theme = THEMES[scheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.paper);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => (preference ? { ...theme, preference, setPreference } : null), [theme, preference, setPreference]);
  if (!value) return null;
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

/**
 * Theme-aware StyleSheet: `const useStyles = makeStyles((c, t) => ({ ... }))` at module level,
 * then `const styles = useStyles()` in the component. Styles are built once per theme and cached.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: Colors, text: TextStyles) => T) {
  const cache = new Map<Colors, T>();
  return function useStyles(): T {
    const { colors, text } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = StyleSheet.create(factory(colors, text));
      cache.set(colors, styles);
    }
    return styles;
  };
}
