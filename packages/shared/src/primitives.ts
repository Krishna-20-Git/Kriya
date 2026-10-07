import { z } from 'zod';

export const LIMITS = {
  fullName: { min: 2, max: 100 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
  projectName: { max: 120 },
  taskName: { max: 160 },
  description: { max: 2000 },
  search: { max: 100 },
  pageSize: { default: 20, max: 100 },
} as const;

/** Non-empty after trimming, so "   " is rejected the same way as "". */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar date in YYYY-MM-DD form. The regex alone would accept 2026-02-31,
 * so the value is round-tripped through Date to reject impossible days.
 */
export const isoDate = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .regex(ISO_DATE, `${label} must be a date in YYYY-MM-DD format`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, `${label} is not a valid calendar date`)
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      return year >= 1900 && year <= 2100;
    }, `${label} must be between the years 1900 and 2100`);

export const uuid = (label = 'ID') => z.uuid({ error: `${label} must be a valid UUID` });

export const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(LIMITS.email.max, 'Email is too long')
  .pipe(z.email({ error: 'Enter a valid email address' }));
