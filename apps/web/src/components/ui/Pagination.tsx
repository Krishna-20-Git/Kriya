import type { PaginationMeta } from '@pms/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './Button';

export function Pagination({ meta, onPageChange, noun }: { meta: PaginationMeta; onPageChange: (page: number) => void; noun: string }) {
  if (meta.total <= meta.limit) return null;
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="tabular text-sm text-muted">
        {first}–{last} of {meta.total} {noun}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1} icon={<ChevronLeft className="size-4" aria-hidden />}>
          Previous
        </Button>
        <Button size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

/**
 * If the current page no longer exists (e.g. its last item was just deleted, or a filter shrank the
 * result), move to the last page that does — instead of showing an empty page with no controls.
 */
export function usePageClamp(meta: PaginationMeta | undefined, setPage: (page: number) => void) {
  const page = meta?.page;
  const totalPages = meta?.totalPages;
  const total = meta?.total;
  useEffect(() => {
    if (page !== undefined && totalPages !== undefined && total && page > totalPages) setPage(totalPages);
  }, [page, totalPages, total, setPage]);
}
