import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from '@pms/shared';
import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';

export interface TaskFilterValues {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
}

export const EMPTY_TASK_FILTERS: TaskFilterValues = { search: '', status: '', priority: '' };

export function SearchInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="pl-8"
        maxLength={100}
      />
    </div>
  );
}

interface Props {
  value: TaskFilterValues;
  onChange: (value: TaskFilterValues) => void;
  children?: ReactNode;
}

export function TaskFilters({ value, onChange, children }: Props) {
  const active = value.search !== '' || value.status !== '' || value.priority !== '';
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput value={value.search} onChange={(search) => onChange({ ...value, search })} label="Search tasks" />
      {children}
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as TaskStatus | '' })}
        className="sm:w-40"
      >
        <option value="">All statuses</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {TASK_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by priority"
        value={value.priority}
        onChange={(event) => onChange({ ...value, priority: event.target.value as TaskPriority | '' })}
        className="sm:w-40"
      >
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {TASK_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </Select>
      {active ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_TASK_FILTERS)} icon={<X className="size-3.5" aria-hidden />}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
