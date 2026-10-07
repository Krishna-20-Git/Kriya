import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePageClamp } from './Pagination';

const meta = (page: number, total: number, limit = 20) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

describe('usePageClamp', () => {
  it('moves to the last page when the current page no longer exists (e.g. its last item was deleted)', () => {
    const setPage = vi.fn();
    renderHook(() => usePageClamp(meta(2, 20), setPage));
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('leaves valid pages, empty results and loading states alone', () => {
    const setPage = vi.fn();
    renderHook(() => usePageClamp(meta(2, 21), setPage));
    renderHook(() => usePageClamp(meta(3, 0), setPage));
    renderHook(() => usePageClamp(undefined, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
