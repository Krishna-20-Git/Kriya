import type { Task } from '@pms/shared';
import { Check, Circle, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../lib/api';
import { useDeleteTask, usePatchTask } from '../lib/queries';
import { cn } from '../lib/utils';
import { DueDate, PriorityBadge, StatusBadge } from './Badges';
import { TaskFormDialog } from './TaskFormDialog';
import { IconButton } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';

interface TaskListProps {
  tasks: Task[];
  showProject?: boolean;
}

/** Wide screens: a table. Narrower: stacked rows that keep every field and action reachable. */
export function TaskList({ tasks, showProject = true }: TaskListProps) {
  const toast = useToast();
  const patch = usePatchTask();
  const remove = useDeleteTask();
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  // mutateAsync (not mutate + per-call callbacks): when the last task in a filtered list changes, the list
  // unmounts after the refetch, and per-call callbacks of an unmounted component never fire.
  const toggleComplete = async (task: Task) => {
    const completed = task.status === 'COMPLETED';
    try {
      await patch.mutateAsync({ id: task.id, input: { status: completed ? 'PENDING' : 'COMPLETED' } });
      toast(completed ? 'Task reopened' : 'Task completed');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast('Task deleted');
      setDeleting(null);
    } catch {
      // The error is shown inside the confirmation dialog via remove.error.
    }
  };

  const pendingId = patch.isPending ? patch.variables?.id : undefined;

  const renderToggle = (task: Task) => {
    const done = task.status === 'COMPLETED';
    return (
      <button
        type="button"
        onClick={() => toggleComplete(task)}
        disabled={pendingId === task.id}
        aria-label={done ? `Reopen “${task.name}”` : `Mark “${task.name}” as completed`}
        aria-pressed={done}
        title={done ? 'Reopen task' : 'Mark as completed'}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 disabled:opacity-50',
          done ? 'border-done bg-done text-on-accent' : 'border-line-strong text-transparent hover:border-done hover:text-done',
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-0" />}
      </button>
    );
  };

  const renderActions = (task: Task) => (
    <div className="flex justify-end gap-0.5">
      <IconButton label={`Edit “${task.name}”`} onClick={() => setEditing(task)}>
        <Pencil className="size-4" />
      </IconButton>
      <IconButton label={`Delete “${task.name}”`} onClick={() => setDeleting(task)} className="hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );

  const nameCell = (task: Task) => (
    <div className="min-w-0">
      <p className={cn('truncate font-medium', task.status === 'COMPLETED' && 'text-muted line-through decoration-faint')}>{task.name}</p>
      {task.description ? <p className="truncate text-sm text-muted">{task.description}</p> : null}
    </div>
  );

  return (
    <>
      {/* Table: 1280px and up (narrower screens use stacked rows, so names never get squeezed) */}
      <table className="hidden w-full table-fixed text-left xl:table">
        <thead>
          <tr className="border-b border-line text-sm text-muted">
            <th scope="col" className="w-12 py-2.5 pl-4 font-medium">
              <span className="sr-only">Completed</span>
            </th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Task</th>
            {showProject ? <th scope="col" className="w-[18%] py-2.5 pr-4 font-medium">Project</th> : null}
            <th scope="col" className="w-24 py-2.5 pr-4 font-medium">Priority</th>
            <th scope="col" className="w-32 py-2.5 pr-4 font-medium">Status</th>
            <th scope="col" className="w-36 py-2.5 pr-4 font-medium">Due</th>
            <th scope="col" className="w-24 py-2.5 pr-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tasks.map((task) => (
            <tr key={task.id} className="transition-colors duration-150 hover:bg-paper">
              <td className="py-3 pl-4 align-middle">
                {renderToggle(task)}
              </td>
              <td className="py-3 pr-4">{nameCell(task)}</td>
              {showProject ? (
                <td className="py-3 pr-4">
                  <Link to={`/projects/${task.projectId}`} className="block truncate text-sm text-ink-2 hover:text-accent hover:underline">
                    {task.project.name}
                  </Link>
                </td>
              ) : null}
              <td className="py-3 pr-4">
                <PriorityBadge priority={task.priority} />
              </td>
              <td className="py-3 pr-4">
                <StatusBadge status={task.status} />
              </td>
              <td className="py-3 pr-4">
                <DueDate value={task.dueDate} completed={task.status === 'COMPLETED'} />
              </td>
              <td className="py-3 pr-3">
                {renderActions(task)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Stacked rows: below 1280px */}
      <ul className="divide-y divide-line xl:hidden">
        {tasks.map((task) => (
          <li key={task.id} className="flex gap-3 px-4 py-3">
            <div className="pt-0.5">
              {renderToggle(task)}
            </div>
            <div className="min-w-0 flex-1">
              {nameCell(task)}
              {showProject ? <p className="mt-0.5 truncate text-sm text-muted">{task.project.name}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <DueDate value={task.dueDate} completed={task.status === 'COMPLETED'} />
              </div>
            </div>
            {renderActions(task)}
          </li>
        ))}
      </ul>

      <TaskFormDialog open={!!editing} task={editing ?? undefined} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete task?"
        message={`“${deleting?.name ?? ''}” will be permanently deleted. This can’t be undone.`}
        confirmLabel="Delete task"
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={confirmDelete}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
      />
    </>
  );
}
