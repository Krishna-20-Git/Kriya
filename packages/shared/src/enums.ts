/**
 * Domain enums. These string values are the contract between the database
 * (Postgres enum types), the API and both clients — change them in one place.
 */

export const PROJECT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Ordered from lowest to highest: the database enum uses the same order, so sorting by priority is meaningful. */
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Roles. USER is everyone's default. ADMIN additionally manages accounts and reads the
 * system-wide audit log — but does not see other users' projects or tasks (privacy by design).
 */
export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: 'User',
  ADMIN: 'Admin',
};

export const AUDIT_ACTIONS = [
  'USER_REGISTERED',
  'LOGIN',
  'LOGOUT',
  'LOGOUT_ALL',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_DELETED',
  'ROLE_CHANGED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_REGISTERED: 'Created account',
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  LOGOUT_ALL: 'Signed out of all devices',
  PROJECT_CREATED: 'Created project',
  PROJECT_UPDATED: 'Updated project',
  PROJECT_DELETED: 'Deleted project',
  TASK_CREATED: 'Created task',
  TASK_UPDATED: 'Updated task',
  TASK_DELETED: 'Deleted task',
  ROLE_CHANGED: 'Changed a user’s role',
};

/** Sort fields the API accepts. Anything else is rejected before it reaches the query builder. */
export const PROJECT_SORT_FIELDS = ['name', 'createdAt', 'startDate', 'endDate', 'status'] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export const TASK_SORT_FIELDS = ['name', 'createdAt', 'dueDate', 'priority', 'status'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
