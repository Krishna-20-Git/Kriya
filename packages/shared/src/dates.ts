/**
 * Calendar-date helpers. Calendar dates (due date, start date) are stored as Postgres `date`
 * and travel as `YYYY-MM-DD`, so no timezone conversion ever shifts them by a day.
 */

/** Today's date in the user's local timezone as YYYY-MM-DD. */
export const todayLocal = (now: Date = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-07" → "Oct 7, 2026". Parsed by hand so the result never depends on the device timezone. */
export const formatCalendarDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

/** Whole days from today to the date (negative = in the past). */
export const daysUntil = (value: string, now: Date = new Date()): number => {
  const [y, m, d] = value.split('-').map(Number);
  const target = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
};

export const describeDueDate = (value: string | null | undefined, completed = false, now: Date = new Date()): string => {
  if (!value) return 'No due date';
  if (completed) return formatCalendarDate(value);
  const days = daysUntil(value, now);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Overdue by 1 day';
  if (days < 0) return `Overdue by ${-days} days`;
  if (days <= 7) return `Due in ${days} days`;
  return formatCalendarDate(value);
};

export const isOverdue = (value: string | null | undefined, completed: boolean, now: Date = new Date()): boolean =>
  !!value && !completed && daysUntil(value, now) < 0;
