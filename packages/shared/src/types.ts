import type { AuditAction, ProjectStatus, TaskPriority, TaskStatus, UserRole } from './enums.js';

/** Dates are ISO strings on the wire: `YYYY-MM-DD` for calendar dates, full ISO-8601 for timestamps. */
export type CalendarDate = string;
export type Timestamp = string;

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp;
}

/** A row in the admin user list: profile plus counts — never the user's project or task contents. */
export interface AdminUser extends User {
  projectCount: number;
  taskCount: number;
  lastActiveAt: Timestamp | null;
}

/** An audit entry as admins see it: includes who performed the action. */
export interface AdminAuditLogEntry extends AuditLogEntry {
  actor: { id: string; fullName: string; email: string };
}

/** A phone registered for due-tomorrow reminders. */
export interface NotificationDevice {
  token: string;
  platform: 'android' | 'ios';
  timezone: string;
  createdAt: Timestamp;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: CalendarDate;
  endDate: CalendarDate | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  taskCount: number;
  completedTaskCount: number;
}

export interface TaskProjectRef {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  projectId: string;
  project: TaskProjectRef;
  name: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: CalendarDate | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Dashboard {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  /** Tasks whose status is PENDING (not started). */
  pendingTasks: number;
  inProgressTasks: number;
  projectsInProgress: number;
  overdueTasks: number;
  projectStatusDistribution: Record<ProjectStatus, number>;
  taskStatusDistribution: Record<TaskStatus, number>;
  taskPriorityDistribution: Record<TaskPriority, number>;
  recentProjects: Project[];
  upcomingTasks: Task[];
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: 'USER' | 'PROJECT' | 'TASK';
  entityId: string | null;
  entityName: string | null;
  createdAt: Timestamp;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Only returned to mobile clients (`X-Client: mobile`). Web clients receive it as an HttpOnly cookie. */
  refreshToken?: string;
}

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'REFRESH_CONFLICT',
  'FORBIDDEN',
  'ROLE_CHANGE_NOT_ALLOWED',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
  };
}

export type Paginated<T> = { items: T[]; meta: PaginationMeta };

/** Header the mobile app sends so the API returns the refresh token in the body instead of a cookie. */
export const CLIENT_HEADER = 'x-client';
export const MOBILE_CLIENT = 'mobile';
