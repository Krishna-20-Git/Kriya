import type {
  AdminAuditLogEntry,
  AdminUser,
  AuditAction,
  AuditLogEntry,
  UserRole,
  CreateProjectInput,
  CreateTaskInput,
  Dashboard,
  PatchProjectInput,
  PatchTaskInput,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskSortField,
  TaskStatus,
  SortOrder,
  ProjectSortField,
} from '@pms/shared';
import { todayLocal } from '@pms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiData, apiPage } from './api';

/**
 * All server state goes through TanStack Query. Keys are hierarchical so one
 * invalidation (e.g. ['tasks']) refreshes every filtered variant of a list.
 */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  activity: ['activity'] as const,
  projects: (params?: ProjectListParams) => (params ? (['projects', params] as const) : (['projects'] as const)),
  project: (id: string) => ['project', id] as const,
  tasks: (params?: TaskListParams) => (params ? (['tasks', params] as const) : (['tasks'] as const)),
  task: (id: string) => ['task', id] as const,
  adminUsers: (params?: AdminUserParams) => (params ? (['admin', 'users', params] as const) : (['admin', 'users'] as const)),
  adminAudit: (params?: AdminAuditParams) => (params ? (['admin', 'audit', params] as const) : (['admin', 'audit'] as const)),
};

export interface AdminUserParams {
  search?: string;
  role?: UserRole | '';
  page?: number;
}

export interface AdminAuditParams {
  userId?: string;
  action?: AuditAction | '';
  page?: number;
}

export interface ProjectListParams {
  search?: string;
  status?: ProjectStatus | '';
  page?: number;
  limit?: number;
  sortBy?: ProjectSortField;
  sortOrder?: SortOrder;
}

export interface TaskListParams {
  search?: string;
  status?: TaskStatus | '';
  priority?: TaskPriority | '';
  projectId?: string;
  page?: number;
  limit?: number;
  sortBy?: TaskSortField;
  sortOrder?: SortOrder;
}

export const useDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiData<Dashboard>('/api/dashboard', { query: { today: todayLocal() } }),
  });

export const useActivity = () =>
  useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => apiData<AuditLogEntry[]>('/api/activity', { query: { limit: 15 } }),
  });

export const useProjects = (params: ProjectListParams) =>
  useQuery({
    queryKey: queryKeys.projects(params),
    queryFn: () => apiPage<Project>('/api/projects', { query: { ...params } }),
    // Keep the current page visible while the next filter result loads — no flash of skeletons.
    placeholderData: keepPreviousData,
  });

/** Every project, for select menus. 100 is the API's page cap. */
export const useProjectOptions = () =>
  useQuery({
    queryKey: queryKeys.projects({ limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    queryFn: () => apiPage<Project>('/api/projects', { query: { limit: 100, sortBy: 'name', sortOrder: 'asc' } }),
    select: (page) => page.items,
  });

export const useProject = (id: string) =>
  useQuery({ queryKey: queryKeys.project(id), queryFn: () => apiData<Project>(`/api/projects/${id}`) });

/** One task, fresh from the server (GET /api/tasks/:id). Disabled when id is ''. */
export const useTask = (id: string) =>
  useQuery({ queryKey: queryKeys.task(id), queryFn: () => apiData<Task>(`/api/tasks/${id}`), enabled: id !== '' });

export const useTasks = (params: TaskListParams, enabled = true) =>
  useQuery({
    queryKey: queryKeys.tasks(params),
    queryFn: () => apiPage<Task>('/api/tasks', { query: { ...params } }),
    placeholderData: keepPreviousData,
    enabled,
  });

/**
 * A task or project change affects lists, counts, progress bars and the dashboard.
 * Invalidating these prefixes refetches only the queries currently on screen.
 */
function useInvalidateWork() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [['tasks'], ['task'], ['projects'], ['project'], queryKeys.dashboard, queryKeys.activity].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
}

export function useCreateProject() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => apiData<Project>('/api/projects', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateProjectInput }) =>
      apiData<Project>(`/api/projects/${id}`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  });
}

export function usePatchProject() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchProjectInput }) =>
      apiData<Project>(`/api/projects/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: (id: string) => apiData<void>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: queryKeys.project(id) });
      return invalidate();
    },
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiData<Task>('/api/tasks', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateTaskInput }) =>
      apiData<Task>(`/api/tasks/${id}`, { method: 'PUT', body: input }),
    onSuccess: invalidate,
  });
}

/** Partial update used for "mark completed" and quick status/priority changes. */
export function usePatchTask() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchTaskInput }) =>
      apiData<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: (id: string) => apiData<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ── Admin (role ADMIN only; the API returns 403 for everyone else) ─────────────

export const useAdminUsers = (params: AdminUserParams) =>
  useQuery({
    queryKey: queryKeys.adminUsers(params),
    queryFn: () => apiPage<AdminUser>('/api/admin/users', { query: { ...params, limit: 20 } }),
    placeholderData: keepPreviousData,
  });

export const useAdminAuditLog = (params: AdminAuditParams) =>
  useQuery({
    queryKey: queryKeys.adminAudit(params),
    queryFn: () => apiPage<AdminAuditLogEntry>('/api/admin/audit-logs', { query: { ...params, limit: 15 } }),
    placeholderData: keepPreviousData,
  });

export function useChangeRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => apiData<AdminUser>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }),
  });
}
