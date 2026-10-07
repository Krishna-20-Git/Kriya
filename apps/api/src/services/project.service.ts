import {
  endDateIsValid,
  type CreateProjectInput,
  type PatchProjectInput,
  type Project,
  type ProjectListQuery,
} from '@pms/shared';
import { db } from '../db/client.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { notFound, validationError } from '../utils/app-error.js';
import { pageMeta } from '../utils/http.js';
import { toProject } from '../utils/serializers.js';

const PROJECT = 'Project';

async function getOwned(userId: string, id: string): Promise<Project> {
  const project = await projectRepository.findOwned(db, userId, id);
  // 404 (not 403) for other users' projects: the API does not confirm that the ID exists.
  if (!project) throw notFound(PROJECT);
  return toProject(project);
}

export const projectService = {
  async list(userId: string, query: ProjectListQuery) {
    const { items, total } = await projectRepository.list(db, userId, query);
    return { items: items.map(toProject), meta: pageMeta(query.page, query.limit, total) };
  },

  get: getOwned,

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    const id = await db.transaction(async (tx) => {
      const projectId = await projectRepository.create(tx, userId, input);
      await auditRepository.record(tx, { userId, action: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: projectId, entityName: input.name });
      return projectId;
    });
    return getOwned(userId, id);
  },

  /** Handles both PUT (full input) and PATCH (partial input). */
  async update(userId: string, id: string, changes: CreateProjectInput | PatchProjectInput): Promise<Project> {
    await db.transaction(async (tx) => {
      const current = await projectRepository.findOwned(tx, userId, id);
      if (!current) throw notFound(PROJECT);

      // A PATCH may change only one of the two dates, so validate against the merged result.
      const startDate = changes.startDate ?? current.startDate;
      const endDate = changes.endDate !== undefined ? changes.endDate : current.endDate;
      if (!endDateIsValid(startDate, endDate)) {
        throw validationError('Request validation failed', [
          { path: 'endDate', message: 'End date cannot be before the start date' },
        ]);
      }

      const updated = await projectRepository.update(tx, userId, id, changes);
      if (!updated) throw notFound(PROJECT);
      await auditRepository.record(tx, {
        userId,
        action: 'PROJECT_UPDATED',
        entityType: 'PROJECT',
        entityId: id,
        entityName: changes.name ?? current.name,
      });
    });
    return getOwned(userId, id);
  },

  /** Tasks are removed with the project by the ON DELETE CASCADE foreign key. */
  async remove(userId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const deleted = await projectRepository.delete(tx, userId, id);
      if (!deleted) throw notFound(PROJECT);
      await auditRepository.record(tx, { userId, action: 'PROJECT_DELETED', entityType: 'PROJECT', entityId: id, entityName: deleted.name });
    });
  },
};
