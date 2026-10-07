import { zodResolver } from '@hookform/resolvers/zod';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskFormSchema,
  taskFormToInput,
  type Task,
  type TaskFormValues,
} from '@pms/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, errorMessage } from '../lib/api';
import { useCreateTask, useProjectOptions, useTask, useUpdateTask } from '../lib/queries';
import { Button } from './ui/Button';
import { Dialog, DialogFooter } from './ui/Dialog';
import { Field, Input, Select, Textarea } from './ui/Field';
import { useToast } from './ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  task?: Task;
  /** Preselects the project when creating from a project page. */
  projectId?: string;
}

const defaults = (task?: Task, projectId?: string): TaskFormValues => ({
  projectId: task?.projectId ?? projectId ?? '',
  name: task?.name ?? '',
  description: task?.description ?? '',
  priority: task?.priority ?? 'MEDIUM',
  status: task?.status ?? 'PENDING',
  dueDate: task?.dueDate ?? '',
});

export function TaskFormDialog({ open, onClose, task, projectId }: Props) {
  const toast = useToast();
  const projects = useProjectOptions();
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = task ? update : create;
  // Editing: load the task fresh from GET /api/tasks/:id, so the form never starts from stale list data
  // (e.g. the task was just changed on the phone) and a task deleted elsewhere is detected.
  const latest = useTask(open && task ? task.id : '');
  const deletedElsewhere = latest.error instanceof ApiError && latest.error.status === 404;

  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: defaults(task, projectId) });
  const { register, handleSubmit, formState, reset, setError, setFocus } = form;

  useEffect(() => {
    if (open) {
      reset(defaults(task, projectId));
      mutation.reset();
      setTimeout(() => setFocus('name'), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, task?.id, projectId]);

  // When the fresh copy arrives and differs, show it — unless the user has already started typing.
  useEffect(() => {
    if (open && latest.data && !formState.isDirty) reset(defaults(latest.data, projectId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a newer version of the task arrives
  }, [latest.data?.updatedAt]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input = taskFormToInput(values);
      if (task) await update.mutateAsync({ id: task.id, input });
      else await create.mutateAsync(input);
      toast(task ? 'Task updated' : 'Task created');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        for (const detail of error.details) {
          if (detail.path in values) setError(detail.path as keyof TaskFormValues, { message: detail.message });
        }
      }
    }
  });

  const errors = formState.errors;
  const noProjects = projects.isSuccess && projects.data.length === 0;
  const generalError = mutation.error && !(mutation.error instanceof ApiError && mutation.error.details.length) ? errorMessage(mutation.error) : null;

  return (
    <Dialog open={open} onClose={onClose} title={task ? 'Edit task' : 'New task'}>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Task name" error={errors.name?.message} className="sm:col-span-2">
            {(a11y) => <Input {...a11y} {...register('name')} placeholder="e.g. Write release notes" autoComplete="off" />}
          </Field>
          <Field label="Description" optional error={errors.description?.message} className="sm:col-span-2">
            {(a11y) => <Textarea {...a11y} {...register('description')} placeholder="Add details, links or acceptance criteria" />}
          </Field>
          <Field
            label="Project"
            error={errors.projectId?.message}
            hint={noProjects ? 'Create a project first — every task belongs to one.' : undefined}
            className="sm:col-span-2"
          >
            {(a11y) => (
              <Select {...a11y} {...register('projectId')}>
                <option value="">{projects.isPending ? 'Loading projects…' : 'Select a project'}</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority" error={errors.priority?.message}>
            {(a11y) => (
              <Select {...a11y} {...register('priority')}>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status" error={errors.status?.message}>
            {(a11y) => (
              <Select {...a11y} {...register('status')}>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Due date" optional error={errors.dueDate?.message}>
            {(a11y) => <Input type="date" {...a11y} {...register('dueDate')} />}
          </Field>
          {deletedElsewhere ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
              This task no longer exists — it may have been deleted on another device.
            </p>
          ) : null}
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
          <Button type="submit" variant="primary" loading={formState.isSubmitting} disabled={noProjects || deletedElsewhere}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
