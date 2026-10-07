import { CloudOff, RotateCw, ServerCrash } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-sm bg-sunken motion-safe:animate-pulse', className)} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="hidden h-4 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-sunken text-muted" aria-hidden>
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-base text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Distinguishes "you are offline" from "the server is down" from other failures — never a blank screen. */
export function ErrorState({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const network = error instanceof ApiError && error.isNetwork;
  const offline = network && typeof navigator !== 'undefined' && navigator.onLine === false;
  const title = offline ? 'No internet connection' : network ? 'Unable to connect to the server' : "This couldn't be loaded";
  const description = offline
    ? 'Check your connection and try again.'
    : network
      ? 'The server didn’t respond. Check your connection, then try again.'
      : error instanceof ApiError
        ? error.message
        : 'Something went wrong. Please try again.';

  return (
    <div role="alert" className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-danger-soft text-danger" aria-hidden>
        {network ? <CloudOff className="size-5" /> : <ServerCrash className="size-5" />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-base text-muted">{description}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry} icon={<RotateCw className="size-4" aria-hidden />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-lg border border-line bg-surface', className)}>{children}</section>;
}

export function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
