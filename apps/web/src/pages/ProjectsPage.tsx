import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, formatCalendarDate, formatTimestamp, type Project, type ProjectStatus } from '@pms/shared';
import { FolderPlus, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ProgressBar, StatusBadge } from '../components/Badges';
import { PageHeader } from '../components/PageHeader';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { SearchInput } from '../components/TaskFilters';
import { Button, IconButton } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Select } from '../components/ui/Field';
import { Pagination, usePageClamp } from '../components/ui/Pagination';
import { EmptyState, ErrorState, Panel, SkeletonRows } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { useDeleteProject, useProjects } from '../lib/queries';
import { useDebouncedValue } from '../lib/utils';

const PAGE_SIZE = 10;

const SORTS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  name: { sortBy: 'name', sortOrder: 'asc', label: 'Name (A–Z)' },
  start: { sortBy: 'startDate', sortOrder: 'asc', label: 'Start date' },
  end: { sortBy: 'endDate', sortOrder: 'asc', label: 'End date' },
} as const;
type SortKey = keyof typeof SORTS;

export function ProjectsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  // Filters live in the URL, so a filtered view survives reloads and the back button.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as ProjectStatus | '';
  const sort = (params.get('sort') ?? 'newest') as SortKey;
  const page = Number(params.get('page') ?? '1') || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());

  const sortConfig = SORTS[sort] ?? SORTS.newest;
  const projects = useProjects({
    search: debouncedSearch,
    status,
    page,
    limit: PAGE_SIZE,
    sortBy: sortConfig.sortBy,
    sortOrder: sortConfig.sortOrder,
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const remove = useDeleteProject();

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };
  usePageClamp(projects.data?.meta, (p) => updateParams({ page: String(p) }));

  const onSearch = (value: string) => {
    setSearch(value);
    updateParams({ q: value.trim() });
  };

  const filtered = debouncedSearch !== '' || status !== '';
  const items = projects.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage your projects and track progress."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
            New project
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={onSearch} label="Search projects" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => updateParams({ status: e.target.value })} className="sm:w-44">
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select aria-label="Sort projects" value={sort} onChange={(e) => updateParams({ sort: e.target.value === 'newest' ? '' : e.target.value })} className="sm:ml-auto sm:w-44">
          {Object.entries(SORTS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </Select>
      </div>

      <Panel className="overflow-hidden">
        {projects.isPending ? (
          <SkeletonRows rows={6} />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
        ) : items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX className="size-5" />} title="No results found" description="Try adjusting your search or filters." />
          ) : (
            <EmptyState
              icon={<FolderPlus className="size-5" />}
              title="No projects yet"
              description="Create your first project to start organizing your work."
              action={
                <Button variant="primary" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
                  Create project
                </Button>
              }
            />
          )
        ) : (
          <div className={projects.isPlaceholderData ? 'opacity-60 transition-opacity duration-150' : undefined} aria-busy={projects.isFetching}>
            <table className="hidden w-full table-fixed text-left md:table">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th scope="col" className="py-2.5 pr-4 pl-4 font-medium">Project</th>
                  <th scope="col" className="w-32 py-2.5 pr-4 font-medium">Status</th>
                  <th scope="col" className="w-40 py-2.5 pr-4 font-medium">Progress</th>
                  <th scope="col" className="hidden w-28 py-2.5 pr-4 font-medium xl:table-cell">Start</th>
                  <th scope="col" className="hidden w-28 py-2.5 pr-4 font-medium xl:table-cell">End</th>
                  <th scope="col" className="hidden w-28 py-2.5 pr-4 font-medium xl:table-cell">Created</th>
                  <th scope="col" className="w-24 py-2.5 pr-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((project) => (
                  <tr key={project.id} className="transition-colors duration-150 hover:bg-paper">
                    <td className="py-3 pr-4 pl-4">
                      <Link to={`/projects/${project.id}`} className="block truncate font-medium hover:text-accent hover:underline">
                        {project.name}
                      </Link>
                      {project.description ? <p className="hidden truncate text-sm text-muted xl:block">{project.description}</p> : null}
                      {/* Below 1280px the date columns are hidden; the dates move under the name instead. */}
                      <p className="tabular truncate text-sm text-muted xl:hidden">
                        {formatCalendarDate(project.startDate)} – {formatCalendarDate(project.endDate)}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <ProgressBar done={project.completedTaskCount} total={project.taskCount} />
                    </td>
                    <td className="tabular hidden py-3 pr-4 text-sm text-ink-2 xl:table-cell">{formatCalendarDate(project.startDate)}</td>
                    <td className="tabular hidden py-3 pr-4 text-sm text-ink-2 xl:table-cell">{formatCalendarDate(project.endDate)}</td>
                    <td className="tabular hidden py-3 pr-4 text-sm text-muted xl:table-cell">{formatTimestamp(project.createdAt)}</td>
                    <td className="py-3 pr-3">
                      <div className="flex justify-end gap-0.5">
                        <IconButton label={`Edit “${project.name}”`} onClick={() => setEditing(project)}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label={`Delete “${project.name}”`} onClick={() => setDeleting(project)} className="hover:bg-danger-soft hover:text-danger">
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {items.map((project) => (
                <li key={project.id}>
                  <button type="button" onClick={() => navigate(`/projects/${project.id}`)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left">
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">{project.name}</span>
                      <StatusBadge status={project.status} />
                    </div>
                    <ProgressBar done={project.completedTaskCount} total={project.taskCount} className="w-full" />
                    <span className="tabular text-sm text-muted">
                      {formatCalendarDate(project.startDate)} – {formatCalendarDate(project.endDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {projects.data ? <Pagination meta={projects.data.meta} noun="projects" onPageChange={(p) => updateParams({ page: String(p) })} /> : null}
          </div>
        )}
      </Panel>

      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/projects/${p.id}`)} />
      <ProjectFormDialog open={!!editing} project={editing ?? undefined} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete project?"
        message={`“${deleting?.name ?? ''}” and its ${deleting?.taskCount ?? 0} task${deleting?.taskCount === 1 ? '' : 's'} will be permanently deleted. This can’t be undone.`}
        confirmLabel="Delete project"
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast('Project deleted');
            setDeleting(null);
          } catch {
            // Shown in the dialog via remove.error.
          }
        }}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
      />
    </>
  );
}
