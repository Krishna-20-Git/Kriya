import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  describeDueDate,
  isOverdue,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@pms/shared';
import { cn, percent } from '../lib/utils';

const STATUS_STYLE: Record<ProjectStatus | TaskStatus, { dot: string; badge: string }> = {
  NOT_STARTED: { dot: 'bg-pending', badge: 'bg-pending-soft text-pending' },
  PENDING: { dot: 'bg-pending', badge: 'bg-pending-soft text-pending' },
  IN_PROGRESS: { dot: 'bg-progress', badge: 'bg-progress-soft text-progress' },
  COMPLETED: { dot: 'bg-done', badge: 'bg-done-soft text-done' },
};

/** Colour is never the only signal: every badge also has a text label. */
export function StatusBadge({ status }: { status: ProjectStatus | TaskStatus }) {
  const label = status in PROJECT_STATUS_LABELS ? PROJECT_STATUS_LABELS[status as ProjectStatus] : TASK_STATUS_LABELS[status as TaskStatus];
  const style = STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-sm font-medium whitespace-nowrap', style.badge)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {label}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, { bars: number; color: string }> = {
  LOW: { bars: 1, color: 'text-low' },
  MEDIUM: { bars: 2, color: 'text-medium' },
  HIGH: { bars: 3, color: 'text-high' },
};

/** Signal-strength style bars plus the word, readable without colour. */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const style = PRIORITY_STYLE[priority];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', style.color)}>
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={i * 4.5} y={8 - i * 3.5} width="3" height={4 + i * 3.5} rx="0.75" fill="currentColor" opacity={i < style.bars ? 1 : 0.22} />
        ))}
      </svg>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const value = percent(done, total);
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${done} of ${total} tasks completed`}
        className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full rounded-full bg-done" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular shrink-0 text-sm text-muted">
        {done}/{total}
      </span>
    </div>
  );
}

export function DueDate({ value, completed }: { value: string | null; completed: boolean }) {
  const overdue = isOverdue(value, completed);
  return (
    <span className={cn('text-sm whitespace-nowrap', overdue ? 'font-medium text-danger' : value ? 'text-ink-2' : 'text-faint')}>
      {describeDueDate(value, completed)}
    </span>
  );
}
