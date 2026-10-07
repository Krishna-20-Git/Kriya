import { zodResolver } from '@hookform/resolvers/zod';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, projectFormSchema, projectFormToInput, todayLocal, type Project, type ProjectFormValues } from '@pms/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { DateField } from '../../../src/components/DateField';
import { Notice } from '../../../src/components/Notice';
import { QueryView } from '../../../src/components/states';
import { Button, ChoiceChips, FieldLabel, TextField } from '../../../src/components/ui';
import { ApiError, errorMessage } from '../../../src/lib/api';
import { useCreateProject, useProject, useUpdateProject } from '../../../src/lib/queries';
import { space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

/** One screen for "New project" and "Edit project" (when an `id` param is present). Uses the shared project form schema. */
export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useProject(id ?? '');
  if (id) {
    return <QueryView query={existing}>{(project) => <ProjectForm project={project} />}</QueryView>;
  }
  return <ProjectForm />;
}

function ProjectForm({ project }: { project?: Project }) {
  const styles = useStyles();
  const { statusColors } = useTheme();
  const router = useRouter();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setError } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'NOT_STARTED',
      startDate: project?.startDate ?? todayLocal(),
      endDate: project?.endDate ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const input = projectFormToInput(values);
      if (project) {
        await update.mutateAsync({ id: project.id, input });
        router.back();
      } else {
        const created = await create.mutateAsync(input);
        router.replace(`/projects/${created.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.details.length) {
        for (const detail of error.details) {
          if (detail.path in values) setError(detail.path as keyof ProjectFormValues, { message: detail.message });
        }
        return;
      }
      setServerError(errorMessage(error));
    }
  });

  const errors = formState.errors;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project ? 'Edit project' : 'New project' }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {serverError ? <Notice tone="error">{serverError}</Notice> : null}
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField label="Project name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.name?.message} placeholder="e.g. Website redesign" />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label="Description"
              optional
              multiline
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.description?.message}
              placeholder="What is this project about?"
            />
          )}
        />
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
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s], color: statusColors[s].fg }))}
              />
            )}
          />
        </View>
        <Controller
          control={control}
          name="startDate"
          render={({ field }) => <DateField label="Start date" optional={false} placeholder="Select a date" value={field.value} onChange={field.onChange} error={errors.startDate?.message} />}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field }) => <DateField label="End date" placeholder="No end date" value={field.value} onChange={field.onChange} error={errors.endDate?.message} />}
        />
        <Button
          label={project ? 'Save changes' : 'Create project'}
          variant="primary"
          onPress={onSubmit}
          loading={formState.isSubmitting}
          style={{ marginTop: space.sm }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, backgroundColor: colors.paper },
}));
