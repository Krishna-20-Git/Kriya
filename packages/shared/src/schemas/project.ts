import { z } from 'zod';
import { PROJECT_STATUSES } from '../enums.js';
import { LIMITS, isoDate, optionalText, requiredText } from '../primitives.js';

export const projectStatusSchema = z.enum(PROJECT_STATUSES, {
  error: `Status must be one of: ${PROJECT_STATUSES.join(', ')}`,
});

const projectFields = {
  name: requiredText('Project name', LIMITS.projectName.max),
  description: optionalText('Description', LIMITS.description.max),
  status: projectStatusSchema,
  startDate: isoDate('Start date'),
  endDate: isoDate('End date').nullable(),
};

const END_AFTER_START = {
  path: ['endDate'],
  message: 'End date cannot be before the start date',
};

export const endDateIsValid = (startDate?: string | null, endDate?: string | null) =>
  !startDate || !endDate || endDate >= startDate;

/**
 * POST /api/projects and PUT /api/projects/:id.
 * PUT is a full replacement, so it uses the same schema: omitted optional
 * fields are reset to their defaults rather than left unchanged.
 * strictObject rejects unknown keys such as `userId` (mass-assignment protection).
 */
export const createProjectSchema = z
  .strictObject({
    name: projectFields.name,
    description: projectFields.description.default(''),
    status: projectFields.status.default('NOT_STARTED'),
    startDate: projectFields.startDate,
    endDate: projectFields.endDate.default(null),
  })
  .refine((p) => endDateIsValid(p.startDate, p.endDate), END_AFTER_START);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const replaceProjectSchema = createProjectSchema;
export type ReplaceProjectInput = CreateProjectInput;

/** PATCH /api/projects/:id — any subset of fields, at least one. */
export const patchProjectSchema = z
  .strictObject({
    name: projectFields.name.optional(),
    description: projectFields.description.optional(),
    status: projectFields.status.optional(),
    startDate: projectFields.startDate.optional(),
    endDate: projectFields.endDate.optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  })
  .refine((p) => endDateIsValid(p.startDate, p.endDate), END_AFTER_START);
export type PatchProjectInput = z.infer<typeof patchProjectSchema>;

/** Form schema used by the web app: date inputs produce '' when empty. */
export const projectFormSchema = z
  .object({
    name: projectFields.name,
    description: projectFields.description,
    status: projectFields.status,
    startDate: projectFields.startDate,
    endDate: z.union([z.literal(''), isoDate('End date')]),
  })
  .refine((p) => endDateIsValid(p.startDate, p.endDate || null), END_AFTER_START);
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const projectFormToInput = (values: ProjectFormValues): CreateProjectInput => ({
  name: values.name.trim(),
  description: values.description.trim(),
  status: values.status,
  startDate: values.startDate,
  endDate: values.endDate || null,
});
