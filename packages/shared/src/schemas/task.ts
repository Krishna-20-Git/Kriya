import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../enums.js';
import { LIMITS, isoDate, optionalText, requiredText, uuid } from '../primitives.js';

export const taskStatusSchema = z.enum(TASK_STATUSES, {
  error: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
});
export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
  error: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
});

const taskFields = {
  projectId: uuid('Project ID'),
  name: requiredText('Task name', LIMITS.taskName.max),
  description: optionalText('Description', LIMITS.description.max),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: isoDate('Due date').nullable(),
};

/**
 * POST /api/tasks and PUT /api/tasks/:id (full replacement).
 * The server still checks that `projectId` belongs to the caller — a valid UUID is not proof of ownership.
 */
export const createTaskSchema = z.strictObject({
  projectId: taskFields.projectId,
  name: taskFields.name,
  description: taskFields.description.default(''),
  priority: taskFields.priority.default('MEDIUM'),
  status: taskFields.status.default('PENDING'),
  dueDate: taskFields.dueDate.default(null),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const replaceTaskSchema = createTaskSchema;
export type ReplaceTaskInput = CreateTaskInput;

/** PATCH /api/tasks/:id — used for quick changes such as "mark completed" or "set priority". */
export const patchTaskSchema = z
  .strictObject({
    projectId: taskFields.projectId.optional(),
    name: taskFields.name.optional(),
    description: taskFields.description.optional(),
    priority: taskFields.priority.optional(),
    status: taskFields.status.optional(),
    dueDate: taskFields.dueDate.optional(),
  })
  .refine((t) => Object.values(t).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;

/** Form schema shared by web and mobile: an empty due date input is ''. */
export const taskFormSchema = z.object({
  projectId: z.string().min(1, 'Select a project').pipe(taskFields.projectId),
  name: taskFields.name,
  description: taskFields.description,
  priority: taskFields.priority,
  status: taskFields.status,
  dueDate: z.union([z.literal(''), isoDate('Due date')]),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const taskFormToInput = (values: TaskFormValues): CreateTaskInput => ({
  projectId: values.projectId,
  name: values.name.trim(),
  description: values.description.trim(),
  priority: values.priority,
  status: values.status,
  dueDate: values.dueDate || null,
});
