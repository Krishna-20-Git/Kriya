import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS, type Dashboard } from '@pms/shared';
import { CalendarCheck, FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { DueDate, PriorityBadge, ProgressBar, StatusBadge } from '../components/Badges';
import { PageHeader } from '../components/PageHeader';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { TaskFormDialog } from '../components/TaskFormDialog';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from '../components/ui/States';
import { useDashboard } from '../lib/queries';
import { cn, firstName, greeting, percent } from '../lib/utils';

interface Stat {
  label: string;
  value: number;
  note: string;
  alert?: boolean;
}

function statsFor(d: Dashboard): Stat[] {
  return [
    { label: 'Total projects', value: d.totalProjects, note: `${d.projectStatusDistribution.COMPLETED} completed` },
    { label: 'Total tasks', value: d.totalTasks, note: d.overdueTasks ? `${d.overdueTasks} overdue` : 'None overdue', alert: d.overdueTasks > 0 },
    { label: 'Completed tasks', value: d.completedTasks, note: `${percent(d.completedTasks, d.totalTasks)}% of all tasks` },
    { label: 'Pending tasks', value: d.pendingTasks, note: `${d.inProgressTasks} more in progress` },
    { label: 'Projects in progress', value: d.projectsInProgress, note: `${d.projectStatusDistribution.NOT_STARTED} not started yet` },
  ];
}

/** The five required numbers in one ruled strip: compare at a glance, no card clutter. */
function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat, index) => (
        // The 1px gap over a line-coloured background draws the dividers at every breakpoint.
        <div key={stat.label} className={cn('flex flex-col gap-1 bg-surface px-4 py-4 sm:px-5', index === 4 && 'col-span-2 lg:col-span-1')}>
          <dt className="text-sm text-muted">{stat.label}</dt>
          <dd className="tabular text-[1.875rem] leading-9 font-semibold tracking-tight">{stat.value}</dd>
          <dd className={cn('text-sm', stat.alert ? 'font-medium text-danger' : 'text-muted')}>{stat.note}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Segment {
  label: string;
  value: number;
  color: string;
}

function SegmentedBar({ title, segments }: { title: string; segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-base font-medium">{title}</h3>
        <span className="tabular text-sm text-muted">{total} total</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${title}: ${segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`}>
        {segments.map((s) => (s.value > 0 ? <div key={s.label} className={cn('h-full border-r-2 border-surface last:border-r-0', s.color)} style={{ width: `${(s.value / total) * 100}%` }} /> : null))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-sm text-ink-2">
            <span className={cn('size-2 rounded-full', s.color)} aria-hidden />
            {s.label}
            <span className="tabular font-medium text-ink">{s.value}</span>
            <span className="tabular text-faint">{percent(s.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-6">
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboard();
  const [newProject, setNewProject] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const d = dashboard.data;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user ? firstName(user.fullName) : ''}`}
        description="Here’s an overview of your projects and tasks."
        actions={
          <>
            <Button onClick={() => setNewProject(true)} icon={<FolderPlus className="size-4" aria-hidden />}>
              New project
            </Button>
            <Button variant="primary" onClick={() => setNewTask(true)} disabled={d?.totalProjects === 0} icon={<Plus className="size-4" aria-hidden />}>
              New task
            </Button>
          </>
        }
      />

      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <Panel>
          <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
        </Panel>
      ) : d && d.totalProjects === 0 ? (
        <Panel>
          <EmptyState
            icon={<FolderPlus className="size-5" />}
            title="No projects yet"
            description="Create your first project to start organizing your work. Your statistics will appear here."
            action={
              <Button variant="primary" onClick={() => setNewProject(true)} icon={<Plus className="size-4" aria-hidden />}>
                Create project
              </Button>
            }
          />
        </Panel>
      ) : d ? (
        <div className="flex flex-col gap-6">
          <StatStrip stats={statsFor(d)} />

          <Panel>
            <PanelHeader title="Overview" description="How your work is distributed right now" />
            <div className="grid grid-cols-1 gap-6 p-4 sm:p-5 lg:grid-cols-2 lg:gap-10">
              <SegmentedBar
                title="Tasks by status"
                segments={[
                  { label: TASK_STATUS_LABELS.PENDING, value: d.taskStatusDistribution.PENDING, color: 'bg-pending' },
                  { label: TASK_STATUS_LABELS.IN_PROGRESS, value: d.taskStatusDistribution.IN_PROGRESS, color: 'bg-progress' },
                  { label: TASK_STATUS_LABELS.COMPLETED, value: d.taskStatusDistribution.COMPLETED, color: 'bg-done' },
                ]}
              />
              <SegmentedBar
                title="Projects by status"
                segments={[
                  { label: PROJECT_STATUS_LABELS.NOT_STARTED, value: d.projectStatusDistribution.NOT_STARTED, color: 'bg-pending' },
                  { label: PROJECT_STATUS_LABELS.IN_PROGRESS, value: d.projectStatusDistribution.IN_PROGRESS, color: 'bg-progress' },
                  { label: PROJECT_STATUS_LABELS.COMPLETED, value: d.projectStatusDistribution.COMPLETED, color: 'bg-done' },
                ]}
              />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Recent projects"
                description="Most recently updated"
                action={
                  <Link to="/projects" className="text-sm font-medium text-accent hover:underline">
                    View all
                  </Link>
                }
              />
              <ul className="divide-y divide-line">
                {d.recentProjects.map((project) => (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-paper">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{project.name}</span>
                        <StatusBadge status={project.status} />
                      </div>
                      <ProgressBar done={project.completedTaskCount} total={project.taskCount} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader
                title="Due soon"
                description={d.overdueTasks ? `${d.overdueTasks} overdue, listed first` : 'Open tasks by due date'}
                action={
                  <Link to="/tasks" className="text-sm font-medium text-accent hover:underline">
                    View all
                  </Link>
                }
              />
              {d.upcomingTasks.length === 0 ? (
                <EmptyState icon={<CalendarCheck className="size-5" />} title="Nothing due" description="Open tasks with a due date will show up here." />
              ) : (
                <ul className="divide-y divide-line">
                  {d.upcomingTasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{task.name}</p>
                        <p className="truncate text-sm text-muted">{task.project.name}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <DueDate value={task.dueDate} completed={false} />
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      <ProjectFormDialog open={newProject} onClose={() => setNewProject(false)} />
      <TaskFormDialog open={newTask} onClose={() => setNewTask(false)} />
    </>
  );
}
