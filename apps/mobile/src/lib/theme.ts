import type { TaskPriority, ProjectStatus, TaskStatus } from '@pms/shared';
import type { TextStyle } from 'react-native';

/** Same tokens (and values) as the web app's index.css, so both clients read as one product in both themes. */
export const lightColors = {
  paper: '#F6F7F6',
  surface: '#FFFFFF',
  sunken: '#EEF1EF',
  ink: '#18211E',
  ink2: '#3C4743',
  muted: '#5D6965',
  faint: '#8A9591',
  line: '#E1E5E2',
  lineStrong: '#C9D0CC',
  accent: '#1D6B57',
  accentPressed: '#175747',
  accentSoft: '#E4EFEB',
  onAccent: '#FFFFFF',
  pending: '#5F6B76',
  pendingSoft: '#EEF0F2',
  progress: '#23629F',
  progressSoft: '#E5EEF7',
  done: '#1D6B57',
  doneSoft: '#E4EFEB',
  medium: '#9A5B0B',
  mediumSoft: '#FBF1E1',
  high: '#B3341B',
  highSoft: '#FBE9E5',
  danger: '#B3341B',
  dangerSoft: '#FBE9E5',
  /** Inverse surface: the offline banner and selected chips. */
  inverse: '#18211E',
  onInverse: '#FFFFFF',
  overlay: 'rgba(24,33,30,0.35)',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  paper: '#0F1513',
  surface: '#161E1B',
  sunken: '#1E2925',
  ink: '#E6ECE9',
  ink2: '#C3CCC8',
  muted: '#97A39E',
  faint: '#748580',
  line: '#26312D',
  lineStrong: '#36433E',
  accent: '#5BBE9F',
  accentPressed: '#78CDB2',
  accentSoft: '#1B3A31',
  onAccent: '#0B1411',
  pending: '#A6B2BD',
  pendingSoft: '#252D33',
  progress: '#85B6E8',
  progressSoft: '#1C2D40',
  done: '#5BBE9F',
  doneSoft: '#1B3A31',
  medium: '#E3A85E',
  mediumSoft: '#3A2C17',
  high: '#F1907A',
  highSoft: '#42211A',
  danger: '#F1907A',
  dangerSoft: '#42211A',
  inverse: '#E6ECE9',
  onInverse: '#0F1513',
  overlay: 'rgba(0,0,0,0.55)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 4, md: 8, lg: 12 } as const;

export const makeText = (c: Colors) =>
  ({
    title: { fontSize: 24, lineHeight: 30, fontWeight: '600', color: c.ink },
    heading: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: c.ink },
    body: { fontSize: 15, lineHeight: 21, color: c.ink },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: c.ink2 },
    small: { fontSize: 13, lineHeight: 18, color: c.muted },
  }) satisfies Record<string, TextStyle>;
export type TextStyles = ReturnType<typeof makeText>;

/** Status meaning stays the same in both themes: slate = not started/pending, blue = in progress, green = done. */
export const makeStatusColors = (c: Colors): Record<ProjectStatus | TaskStatus, { fg: string; bg: string }> => ({
  NOT_STARTED: { fg: c.pending, bg: c.pendingSoft },
  PENDING: { fg: c.pending, bg: c.pendingSoft },
  IN_PROGRESS: { fg: c.progress, bg: c.progressSoft },
  COMPLETED: { fg: c.done, bg: c.doneSoft },
});

export const makePriorityColors = (c: Colors): Record<TaskPriority, string> => ({ LOW: c.pending, MEDIUM: c.medium, HIGH: c.high });
