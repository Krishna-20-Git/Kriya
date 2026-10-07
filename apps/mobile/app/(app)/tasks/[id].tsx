import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, describeDueDate, formatCalendarDate, formatTimestamp, type PatchTaskInput } from '@pms/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { DueText} from '../../../src/components/badges';
import { usePullToRefresh } from '../../../src/components/hooks';
import { OfflineBanner, QueryView } from '../../../src/components/states';
import { Button, Card, ChoiceChips, EmptyState, FieldLabel } from '../../../src/components/ui';
import { ApiError, errorMessage } from '../../../src/lib/api';
import { useDeleteTask, usePatchTask, useTask } from '../../../src/lib/queries';
import { space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

export default function TaskDetailScreen() {
  const styles = useStyles();
  const { colors, text, statusColors, priorityColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const task = useTask(id);
  const patch = usePatchTask();
  const remove = useDeleteTask();
  const { refreshing, onRefresh } = usePullToRefresh(['task']);

  // Status and priority change immediately with a PATCH — the same API call the web app makes.
  const change = (input: PatchTaskInput) =>
    patch.mutate({ id, input }, { onError: (error) => Alert.alert('Could not update task', errorMessage(error)) });

  const confirmDelete = (name: string) =>
    Alert.alert('Delete task?', `“${name}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => router.back(),
            onError: (error) => Alert.alert('Could not delete task', errorMessage(error)),
          }),
      },
    ]);

  if (task.error instanceof ApiError && task.error.status === 404) {
    return <EmptyState icon="slash" title="Task not found" description="It may have been deleted on another device." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <QueryView query={task}>
        {(t) => {
          const done = t.status === 'COMPLETED';
          return (
            <ScrollView
              contentContainerStyle={styles.container}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
            >
              <Stack.Screen
                options={{
                  title: 'Task',
                  headerRight: () => (
                    <Button
                      label="Edit"
                      variant="ghost"
                      icon="edit-2"
                      onPress={() => router.push({ pathname: '/tasks/form', params: { id: t.id } })}
                      style={{ minHeight: 36, paddingHorizontal: space.sm }}
                    />
                  ),
                }}
              />
              <View>
                <Text style={[text.title, done && { color: colors.muted, textDecorationLine: 'line-through' }]} accessibilityRole="header">
                  {t.name}
                </Text>
                <Text style={[text.small, { fontSize: 15, marginTop: 4 }]}>{t.project.name}</Text>
              </View>

              {t.description ? (
                <Card style={{ padding: space.lg }}>
                  <Text style={text.body}>{t.description}</Text>
                </Card>
              ) : null}

              <Card style={styles.facts}>
                <View style={{ flex: 1 }}>
                  <Text style={text.small}>Due</Text>
                  <Text style={styles.factValue}>{t.dueDate ? formatCalendarDate(t.dueDate) : 'No due date'}</Text>
                  {/* Relative wording ("Due tomorrow", "Overdue by 2 days") only when it adds something to the date above. */}
                  {t.dueDate && !done && describeDueDate(t.dueDate) !== formatCalendarDate(t.dueDate) ? <DueText value={t.dueDate} completed={false} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={text.small}>Created</Text>
                  <Text style={styles.factValue}>{formatTimestamp(t.createdAt)}</Text>
                </View>
              </Card>

              <View>
                <FieldLabel>Status</FieldLabel>
                <ChoiceChips
                  label="Status"
                  value={t.status}
                  onChange={(status) => change({ status })}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s], color: statusColors[s].fg }))}
                />
              </View>
              <View>
                <FieldLabel>Priority</FieldLabel>
                <ChoiceChips
                  label="Priority"
                  value={t.priority}
                  onChange={(priority) => change({ priority })}
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p], color: priorityColors[p] }))}
                />
              </View>

              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <Button
                  label={done ? 'Reopen task' : 'Mark as completed'}
                  icon={done ? 'rotate-ccw' : 'check'}
                  variant={done ? 'secondary' : 'primary'}
                  loading={patch.isPending}
                  onPress={() => change({ status: done ? 'PENDING' : 'COMPLETED' })}
                />
                <Button label="Delete task" icon="trash-2" variant="danger" loading={remove.isPending} onPress={() => confirmDelete(t.name)} />
              </View>
            </ScrollView>
          );
        }}
      </QueryView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  facts: { flexDirection: 'row', padding: space.lg, gap: space.lg },
  factValue: { fontSize: 15, fontWeight: '500', color: colors.ink, marginTop: 2, marginBottom: 2 },
}));
