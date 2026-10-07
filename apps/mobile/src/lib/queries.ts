import {
  todayLocal,
  type CreateProjectInput,
  type CreateTaskInput,
  type Dashboard,
  type PatchTaskInput,
  type Project,
  type ProjectSortField,
  type ProjectStatus,
  type Task,
  type SortOrder,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
} from '@pms/shared';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiData, apiPage } from './api';

const PAGE_SIZE = 20;

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => apiData<Dashboard>('/api/dashboard', { query: { today: todayLocal() } }) });

export interface ProjectFilters {
  search: string;
  status: ProjectStatus | '';
  sortBy: ProjectSortField;
  sortOrder: SortOrder;
}

/** Search, status filter and sorting all run on the server — the same query the web app sends. */
export const useProjects = (filters: ProjectFilters = { search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc' }) =>
  useQuery({
    queryKey: ['projects', filters],
    queryFn: () => apiPage<Project>('/api/projects', { query: { ...filters, limit: 100 } }),
    select: (page) => page.items,
    // Keep the current list on screen while a new search / filter loads, instead of flashing a spinner.
    placeholderData: keepPreviousData,
  });

export const useProject = (id: string) =>
  useQuery({ queryKey: ['project', id], queryFn: () => apiData<Project>(`/api/projects/${id}`), enabled: id !== '' });

export interface TaskFilters {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  projectId?: string;
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
}

/** Infinite list: the next page loads as the user scrolls to the end. */
export const useTaskList = (filters: TaskFilters) =>
  useInfiniteQuery({
    queryKey: ['tasks', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiPage<Task>('/api/tasks', {
        query: { sortBy: 'createdAt', sortOrder: 'desc', ...filters, page: pageParam, limit: PAGE_SIZE },
      }),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

export const useTask = (id: string) =>
  useQuery({ queryKey: ['task', id], queryFn: () => apiData<Task>(`/api/tasks/${id}`), enabled: id !== '' });

/** After any task change, refresh every view that shows tasks or counts. */
function useInvalidate() {
  const client = useQueryClient();
  return () => Promise.all(['tasks', 'task', 'projects', 'project', 'dashboard'].map((root) => client.invalidateQueries({ queryKey: [root] })));
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiData<Task>('/api/tasks', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTaskInput }) => apiData<Task>(`/api/tasks/${id}`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  });
}

export function usePatchTask() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchTaskInput }) => apiData<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (task) => {
      client.setQueryData(['task', task.id], task);
      return invalidate();
    },
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiData<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: ['task', id] });
      return invalidate();
    },
  });
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => apiData<Project>('/api/projects', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateProjectInput }) => apiData<Project>(`/api/projects/${id}`, { method: 'PUT', body: input }),
    onSuccess: (project) => {
      client.setQueryData(['project', project.id], project);
      return invalidate();
    },
  });
}

/** Deleting a project also deletes its tasks (ON DELETE CASCADE). */
export function useDeleteProject() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiData<void>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: ['project', id] });
      return invalidate();
    },
  });
}
