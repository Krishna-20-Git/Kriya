import { clsx, type ClassValue } from 'clsx';
import { useEffect, useState } from 'react';

export const cn = (...classes: ClassValue[]) => clsx(classes);

/** Delays a fast-changing value (search input) so the API is not called on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

export const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));
