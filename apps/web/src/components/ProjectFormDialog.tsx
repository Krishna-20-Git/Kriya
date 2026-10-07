import { zodResolver } from '@hookform/resolvers/zod';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  projectFormSchema,
  projectFormToInput,
  todayLocal,
  type Project,
  type ProjectFormValues,
} from '@pms/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '../lib/api';
import { useCreateProject, useUpdateProject } from '../lib/queries';
import { Button } from './ui/Button';
import { Dialog, DialogFooter } from './ui/Dialog';
import { Field, Input, Select, Textarea } from './ui/Field';
import { useToast } from './ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present when editing. */
  project?: Project;
  onSaved?: (project: Project) => void;
}

const defaults = (project?: Project): ProjectFormValues => ({
  name: project?.name ?? '',
  description: project?.description ?? '',
  status: project?.status ?? 'NOT_STARTED',
  startDate: project?.startDate ?? todayLocal(),
  endDate: project?.endDate ?? '',
});

export function ProjectFormDialog({ open, onClose, project, onSaved }: Props) {
  const toast = useToast();
  const create = useCreateProject();
  const update = useUpdateProject();
  const mutation = project ? update : create;

  const form = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues: defaults(project) });
  const { register, handleSubmit, formState, reset, setError, setFocus } = form;

  useEffect(() => {
    if (open) {
      reset(defaults(project));
      mutation.reset();
      setTimeout(() => setFocus('name'), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, project?.id]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input = projectFormToInput(values);
      const saved = project ? await update.mutateAsync({ id: project.id, input }) : await create.mutateAsync(input);
      toast(project ? 'Project updated' : 'Project created');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      // Server-side validation errors are mapped back onto the matching fields.
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        for (const detail of error.details) {
          if (detail.path in values) setError(detail.path as keyof ProjectFormValues, { message: detail.message });
        }
      }
    }
  });

  const errors = formState.errors;
  const generalError = mutation.error && !(mutation.error instanceof ApiError && mutation.error.details.length) ? errorMessage(mutation.error) : null;

  return (
    <Dialog open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Project name" error={errors.name?.message} className="sm:col-span-2">
            {(a11y) => <Input {...a11y} {...register('name')} placeholder="e.g. Website redesign" autoComplete="off" />}
          </Field>
          <Field label="Description" optional error={errors.description?.message} className="sm:col-span-2">
            {(a11y) => <Textarea {...a11y} {...register('description')} placeholder="What is this project about?" />}
          </Field>
          <Field label="Status" error={errors.status?.message} className="sm:col-span-2">
            {(a11y) => (
              <Select {...a11y} {...register('status')}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Start date" error={errors.startDate?.message}>
            {(a11y) => <Input type="date" {...a11y} {...register('startDate')} />}
          </Field>
          <Field label="End date" optional error={errors.endDate?.message}>
            {(a11y) => <Input type="date" {...a11y} {...register('endDate')} />}
          </Field>
          {generalError ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
              {generalError}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose} disabled={formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={formState.isSubmitting}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
