import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

/** Reads the colour tokens of one block of index.css (the light @theme block or the dark override). */
function tokens(block: 'light' | 'dark'): Record<string, string> {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
  const start = block === 'light' ? css.indexOf('@theme {') : css.indexOf(":root[data-theme='dark'] {");
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** [foreground, background] pairs that appear as text in the UI. */
const TEXT_PAIRS: [string, string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink-2', 'surface'],
  ['muted', 'surface'],
  ['muted', 'paper'],
  ['muted', 'sunken'],
  ['accent', 'surface'],
  ['on-accent', 'accent'],
  ['on-accent', 'danger'],
  ['danger', 'surface'],
  ['pending', 'pending-soft'],
  ['progress', 'progress-soft'],
  ['done', 'done-soft'],
  ['medium', 'medium-soft'],
  ['high', 'high-soft'],
  ['on-inverse', 'inverse'],
];

describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
  const t = tokens(theme);

  it('defines every token the light theme defines', () => {
    expect(Object.keys(t).sort()).toEqual(Object.keys(tokens('light')).sort());
  });

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('resolveTheme', () => {
  it('uses an explicit choice regardless of the OS', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
  it('follows the OS for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
