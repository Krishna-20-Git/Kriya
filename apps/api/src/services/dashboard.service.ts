import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Dashboard,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@pms/shared';
import { db } from '../db/client.js';
import { projectRepository } from '../repositories/project.repository.js';
import { taskRepository } from '../repositories/task.repository.js';
import { toProject, toTask } from '../utils/serializers.js';

const zeroed = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

export const dashboardService = {
  /**
   * Every number is computed from the caller's own rows at request time — nothing is cached
   * or hard-coded. `today` comes from the client so "overdue" follows the user's timezone.
   */
  async get(userId: string, today: string): Promise<Dashboard> {
    const [projectCounts, taskCounts, overdueTasks, recent, dueSoon] = await Promise.all([
      projectRepository.countByStatus(db, userId),
      taskRepository.countByStatusAndPriority(db, userId),
      taskRepository.countOverdue(db, userId, today),
      projectRepository.recent(db, userId, 5),
      taskRepository.dueSoon(db, userId, 6),
    ]);

    const projectStatusDistribution = zeroed<ProjectStatus>(PROJECT_STATUSES);
    for (const row of projectCounts) projectStatusDistribution[row.status] = row.total;

    const taskStatusDistribution = zeroed<TaskStatus>(TASK_STATUSES);
    const taskPriorityDistribution = zeroed<TaskPriority>(TASK_PRIORITIES);
    for (const row of taskCounts) {
      taskStatusDistribution[row.status] += row.total;
      taskPriorityDistribution[row.priority] += row.total;
    }

    return {
      totalProjects: sum(projectStatusDistribution),
      totalTasks: sum(taskStatusDistribution),
      completedTasks: taskStatusDistribution.COMPLETED,
      pendingTasks: taskStatusDistribution.PENDING,
      inProgressTasks: taskStatusDistribution.IN_PROGRESS,
      projectsInProgress: projectStatusDistribution.IN_PROGRESS,
      overdueTasks,
      projectStatusDistribution,
      taskStatusDistribution,
      taskPriorityDistribution,
      recentProjects: recent.map(toProject),
      upcomingTasks: dueSoon.map(toTask),
    };
  },
};
