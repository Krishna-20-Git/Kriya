import { formatCalendarDate, formatTimestamp } from '@pms/shared';
import { ChevronRight, ListTodo, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ProgressBar, StatusBadge } from '../components/Badges';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { EMPTY_TASK_FILTERS, TaskFilters, type TaskFilterValues } from '../components/TaskFilters';
import { TaskFormDialog } from '../components/TaskFormDialog';
import { TaskList } from '../components/TaskList';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination, usePageClamp } from '../components/ui/Pagination';
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton, SkeletonRows } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { ApiError, errorMessage } from '../lib/api';
import { useDeleteProject, useProject, useTasks } from '../lib/queries';
import { useDebouncedValue } from '../lib/utils';
import { NotFoundPage } from './NotFoundPage';

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const project = useProject(id);

  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_TASK_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search.trim());
  const tasks = useTasks(
    { projectId: id, search, status: filters.status, priority: filters.priority, page, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
    project.isSuccess,
  );
  usePageClamp(tasks.data?.meta, setPage);

  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteProject();

  // Missing, malformed or someone else's project: the API answers 404/400 and we show a not-found page.
  if (project.error instanceof ApiError && (project.error.status === 404 || project.error.status === 400)) {
    return <NotFoundPage resource="project" />;
  }

  if (project.isError) {
    return (
      <Panel>
        <ErrorState error={project.error} onRetry={() => project.refetch()} />
      </Panel>
    );
  }

  const p = project.data;
  const filtered = filters.search !== '' || filters.status !== '' || filters.priority !== '';

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted">
        <Link to="/projects" className="hover:text-ink hover:underline">
          Projects
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-ink-2" aria-current="page">
          {p?.name ?? 'Loading…'}
        </span>
      </nav>

      {!p ? (
        <div role="status" aria-label="Loading project" className="mb-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="mt-2 h-20 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight break-words">{p.name}</h1>
                <StatusBadge status={p.status} />
              </div>
              {p.description ? <p className="mt-1.5 max-w-prose text-base whitespace-pre-line text-ink-2">{p.description}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setEditing(true)} icon={<Pencil className="size-4" aria-hidden />}>
                Edit
              </Button>
              <Button onClick={() => setDeleting(true)} icon={<Trash2 className="size-4" aria-hidden />} className="hover:border-danger/40 hover:text-danger">
                Delete
              </Button>
            </div>
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {[
              ['Start date', formatCalendarDate(p.startDate)],
              ['End date', formatCalendarDate(p.endDate)],
              ['Created', formatTimestamp(p.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-4 py-3">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="tabular mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
            <div className="bg-surface px-4 py-3">
              <dt className="text-sm text-muted">Progress</dt>
              <dd className="mt-1.5">
                <ProgressBar done={p.completedTaskCount} total={p.taskCount} />
              </dd>
            </div>
          </dl>
        </>
      )}

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Tasks"
          description={p ? `${p.completedTaskCount} of ${p.taskCount} completed` : undefined}
          action={
            <Button variant="primary" size="sm" onClick={() => setCreatingTask(true)} disabled={!p} icon={<Plus className="size-4" aria-hidden />}>
              New task
            </Button>
          }
        />
        <div className="border-b border-line px-4 py-3">
          <TaskFilters
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
          />
        </div>
        {tasks.isPending ? (
          <SkeletonRows rows={4} />
        ) : tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} compact />
        ) : tasks.data.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX className="size-5" />} title="No results found" description="Try adjusting your search or filters." />
          ) : (
            <EmptyState
              icon={<ListTodo className="size-5" />}
              title="No tasks found"
              description="Create a task to start tracking your work."
              action={
                <Button variant="primary" onClick={() => setCreatingTask(true)} icon={<Plus className="size-4" aria-hidden />}>
                  Create task
                </Button>
              }
            />
          )
        ) : (
          <div className={tasks.isPlaceholderData ? 'opacity-60' : undefined}>
            <TaskList tasks={tasks.data.items} showProject={false} />
            <Pagination meta={tasks.data.meta} noun="tasks" onPageChange={setPage} />
          </div>
        )}
      </Panel>

      {p ? (
        <>
          <ProjectFormDialog open={editing} project={p} onClose={() => setEditing(false)} />
          <TaskFormDialog open={creatingTask} projectId={p.id} onClose={() => setCreatingTask(false)} />
          <ConfirmDialog
            open={deleting}
            title="Delete project?"
            message={`“${p.name}” and its ${p.taskCount} task${p.taskCount === 1 ? '' : 's'} will be permanently deleted. This can’t be undone.`}
            confirmLabel="Delete project"
            pending={remove.isPending}
            error={remove.error ? errorMessage(remove.error) : null}
            onConfirm={async () => {
              try {
                await remove.mutateAsync(p.id);
                toast('Project deleted');
                navigate('/projects', { replace: true });
              } catch {
                // Shown in the dialog via remove.error.
              }
            }}
            onClose={() => {
              setDeleting(false);
              remove.reset();
            }}
          />
        </>
      ) : null}
    </>
  );
}
