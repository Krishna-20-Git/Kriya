import type { PaginationMeta } from '@pms/shared';
import type { Response } from 'express';
import type { z } from 'zod';

export const sendData = <T>(res: Response, data: T, status = 200) => res.status(status).json({ success: true, data });

export const sendPage = <T>(res: Response, items: T[], meta: PaginationMeta) =>
  res.status(200).json({ success: true, data: items, meta });

export const sendNoContent = (res: Response) => res.status(204).end();

/**
 * Parses untrusted input. Throws ZodError on failure, which the error middleware
 * turns into a 400 VALIDATION_ERROR with per-field details.
 */
export const parse = <S extends z.ZodType>(schema: S, value: unknown): z.output<S> => schema.parse(value);

export const pageMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Escapes LIKE wildcards so a search for "100%" matches the literal text, not everything. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
