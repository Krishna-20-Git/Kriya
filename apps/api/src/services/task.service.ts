import type { CreateTaskInput, PatchTaskInput, Task, TaskListQuery, TaskStatus } from '@pms/shared';
import { db, type Executor } from '../db/client.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository, type TaskData } from '../repositories/task.repository.js';
import { notFound } from '../utils/app-error.js';
import { pageMeta } from '../utils/http.js';
import { toTask } from '../utils/serializers.js';

const TASK = 'Task';

async function getOwned(userId: string, id: string): Promise<Task> {
  const task = await taskRepository.findOwned(db, userId, id);
  if (!task) throw notFound(TASK);
  return toTask(task);
}

/**
 * The project ID in the request body is untrusted: a user could submit another user's
 * project ID to plant a task in it. Ownership is checked before any write.
 */
async function assertProjectOwned(tx: Executor, userId: string, projectId: string) {
  if (!(await projectRepository.exists(tx, userId, projectId))) throw notFound('Project');
}

/** completedAt is server-managed: set when a task becomes COMPLETED, cleared when it is reopened. */
const completedAtFor = (status: TaskStatus, previous: Date | null) =>
  status === 'COMPLETED' ? (previous ?? new Date()) : null;

export const taskService = {
  async list(userId: string, query: TaskListQuery) {
    if (query.projectId) await assertProjectOwned(db, userId, query.projectId);
    const { items, total } = await taskRepository.list(db, userId, query);
    return { items: items.map(toTask), meta: pageMeta(query.page, query.limit, total) };
  },

  get: getOwned,

  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    const id = await db.transaction(async (tx) => {
      await assertProjectOwned(tx, userId, input.projectId);
      const taskId = await taskRepository.create(tx, { ...input, completedAt: completedAtFor(input.status, null) });
      await auditRepository.record(tx, { userId, action: 'TASK_CREATED', entityType: 'TASK', entityId: taskId, entityName: input.name });
      return taskId;
    });
    return getOwned(userId, id);
  },

  /** Handles both PUT (full input) and PATCH (partial input). */
  async update(userId: string, id: string, changes: CreateTaskInput | PatchTaskInput): Promise<Task> {
    await db.transaction(async (tx) => {
      const current = await taskRepository.findOwned(tx, userId, id);
      if (!current) throw notFound(TASK);
      if (changes.projectId && changes.projectId !== current.projectId) {
        await assertProjectOwned(tx, userId, changes.projectId);
      }

      const data: Partial<TaskData> = { ...changes };
      if (changes.status) data.completedAt = completedAtFor(changes.status, current.completedAt);

      const updated = await taskRepository.update(tx, userId, id, data);
      if (!updated) throw notFound(TASK);
      await auditRepository.record(tx, {
        userId,
        action: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: id,
        entityName: changes.name ?? current.name,
      });
    });
    return getOwned(userId, id);
  },

  async remove(userId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const deleted = await taskRepository.delete(tx, userId, id);
      if (!deleted) throw notFound(TASK);
      await auditRepository.record(tx, { userId, action: 'TASK_DELETED', entityType: 'TASK', entityId: id, entityName: deleted.name });
    });
  },
};
