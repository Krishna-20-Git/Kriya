import type { TaskSortField, SortOrder } from '@pms/shared';
import { ListTodo, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EMPTY_TASK_FILTERS, TaskFilters, type TaskFilterValues } from '../components/TaskFilters';
import { TaskFormDialog } from '../components/TaskFormDialog';
import { TaskList } from '../components/TaskList';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Pagination, usePageClamp } from '../components/ui/Pagination';
import { EmptyState, ErrorState, Panel, SkeletonRows } from '../components/ui/States';
import { useProjectOptions, useTasks } from '../lib/queries';
import { useDebouncedValue } from '../lib/utils';

const SORTS: Record<string, { sortBy: TaskSortField; sortOrder: SortOrder; label: string }> = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  due: { sortBy: 'dueDate', sortOrder: 'asc', label: 'Due date' },
  priority: { sortBy: 'priority', sortOrder: 'desc', label: 'Priority' },
  name: { sortBy: 'name', sortOrder: 'asc', label: 'Name (A–Z)' },
};

export function TasksPage() {
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_TASK_FILTERS);
  const [projectId, setProjectId] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const search = useDebouncedValue(filters.search.trim());
  const projects = useProjectOptions();
  const sortConfig = SORTS[sort] ?? SORTS.newest!;
  const tasks = useTasks({
    search,
    status: filters.status,
    priority: filters.priority,
    projectId: projectId || undefined,
    page,
    limit: 20,
    sortBy: sortConfig.sortBy,
    sortOrder: sortConfig.sortOrder,
  });
  usePageClamp(tasks.data?.meta, setPage);

  const filtered = filters.search !== '' || filters.status !== '' || filters.priority !== '' || projectId !== '';
  const noProjects = projects.isSuccess && projects.data.length === 0;

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Track and manage work across your projects."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)} disabled={noProjects} icon={<Plus className="size-4" aria-hidden />}>
            New task
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <TaskFilters
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        >
          <Select
            aria-label="Filter by project"
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setPage(1);
            }}
            className="sm:w-48"
          >
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </TaskFilters>
        <Select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value)} className="lg:ml-auto lg:w-40">
          {Object.entries(SORTS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </Select>
      </div>

      <Panel className="overflow-hidden">
        {tasks.isPending ? (
          <SkeletonRows rows={8} />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        ) : tasks.data.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX className="size-5" />} title="No results found" description="Try adjusting your search or filters." />
          ) : (
            <EmptyState
              icon={<ListTodo className="size-5" />}
              title="No tasks found"
              description={noProjects ? 'Create a project first, then add tasks to it.' : 'Create a task to start tracking your work.'}
              action={
                noProjects ? undefined : (
                  <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
                    Create task
                  </Button>
                )
              }
            />
          )
        ) : (
          <div className={tasks.isPlaceholderData ? 'opacity-60' : undefined}>
            <TaskList tasks={tasks.data.items} />
            <Pagination meta={tasks.data.meta} noun="tasks" onPageChange={setPage} />
          </div>
        )}
      </Panel>

      <TaskFormDialog open={creating} projectId={projectId || undefined} onClose={() => setCreating(false)} />
    </>
  );
}
