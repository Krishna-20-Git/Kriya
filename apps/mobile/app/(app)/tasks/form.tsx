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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { DateField } from '../../../src/components/DateField';
import { Notice } from '../../../src/components/Notice';
import { QueryView } from '../../../src/components/states';
import { Button, ChoiceChips, EmptyState, FieldLabel, TextField } from '../../../src/components/ui';
import { ApiError, errorMessage } from '../../../src/lib/api';
import { useCreateTask, useProjects, useTask, useUpdateTask } from '../../../src/lib/queries';
import { space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

/** One screen for "New task" and "Edit task" (when an `id` param is present). */
export default function TaskFormScreen() {
  const { id, projectId } = useLocalSearchParams<{ id?: string; projectId?: string }>();
  const existing = useTask(id ?? '');
  if (id) {
    return <QueryView query={existing}>{(task) => <TaskForm task={task} />}</QueryView>;
  }
  return <TaskForm projectId={projectId} />;
}

function TaskForm({ task, projectId }: { task?: Task; projectId?: string }) {
  const styles = useStyles();
  const { text, statusColors, priorityColors } = useTheme();
  const router = useRouter();
  const projects = useProjects();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState, setError } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      projectId: task?.projectId ?? projectId ?? '',
      name: task?.name ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'MEDIUM',
      status: task?.status ?? 'PENDING',
      dueDate: task?.dueDate ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const input = taskFormToInput(values);
      if (task) await update.mutateAsync({ id: task.id, input });
      else await create.mutateAsync(input);
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.details.length) {
        for (const detail of error.details) {
          if (detail.path in values) setError(detail.path as keyof TaskFormValues, { message: detail.message });
        }
        return;
      }
      setServerError(errorMessage(error));
    }
  });

  const errors = formState.errors;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: task ? 'Edit task' : 'New task' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {serverError ? <Notice tone="error">{serverError}</Notice> : null}

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField label="Task name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} placeholder="e.g. Write release notes" />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField label="Description" optional multiline value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.description?.message} />
          )}
        />

        <View>
          <FieldLabel>Project</FieldLabel>
          <QueryView query={projects}>
            {(items) =>
              items.length === 0 ? (
                <EmptyState
                  icon="folder"
                  title="No projects yet"
                  description="Every task belongs to a project. Create one first."
                  action={<Button label="Create project" icon="plus" onPress={() => router.push('/projects/form')} />}
                />
              ) : (
                <Controller
                  control={control}
                  name="projectId"
                  render={({ field }) => (
                    <ChoiceChips label="Project" value={field.value} onChange={field.onChange} options={items.map((p) => ({ value: p.id, label: p.name }))} />
                  )}
                />
              )
            }
          </QueryView>
          {errors.projectId ? <Text style={styles.error}>{errors.projectId.message}</Text> : null}
        </View>

        <View>
          <FieldLabel>Priority</FieldLabel>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <ChoiceChips
                label="Priority"
                value={field.value}
                onChange={field.onChange}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p], color: priorityColors[p] }))}
              />
            )}
          />
        </View>

        <View>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <ChoiceChips
                label="Status"
                value={field.value}
                onChange={field.onChange}
                options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s], color: statusColors[s].fg }))}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => <DateField label="Due date" value={field.value} onChange={field.onChange} error={errors.dueDate?.message} />}
        />

        <Button label={task ? 'Save changes' : 'Create task'} variant="primary" onPress={onSubmit} loading={formState.isSubmitting} style={{ marginTop: space.sm }} />
        <Text style={[text.small, { textAlign: 'center' }]}>Saved to your account — the web app shows it on its next refresh.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, backgroundColor: colors.paper },
  error: { fontSize: 13, color: colors.danger, marginTop: 6 },
}));
