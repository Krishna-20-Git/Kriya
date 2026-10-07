import { Feather } from '@expo/vector-icons';
import { TASK_STATUSES, TASK_STATUS_LABELS, formatCalendarDate, formatTimestamp, type TaskStatus } from '@pms/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '../../../src/components/badges';
import { SelectChip } from '../../../src/components/filters';
import { usePullToRefresh, useToggleComplete } from '../../../src/components/hooks';
import { Separator, TaskRow } from '../../../src/components/rows';
import { ErrorView, Loading, OfflineBanner } from '../../../src/components/states';
import { Button, Card, EmptyState, ProgressBar } from '../../../src/components/ui';
import { ApiError, errorMessage } from '../../../src/lib/api';
import { useDeleteProject, useProject, useTaskList } from '../../../src/lib/queries';
import { radius, space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

function Fact({ icon, label, value }: { icon: ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.factLabel}>
        <Feather name={icon} size={13} color={colors.muted} />
        <Text style={text.small}>{label}</Text>
      </View>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const styles = useStyles();
  const { colors, text, statusColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const project = useProject(id);
  const remove = useDeleteProject();
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const tasks = useTaskList({ search: '', status, priority: '', projectId: id });
  const { refreshing, onRefresh } = usePullToRefresh(['project', 'tasks']);
  const { toggle, pendingId } = useToggleComplete();

  if (project.error instanceof ApiError && project.error.status === 404) {
    return <EmptyState icon="slash" title="Project not found" description="It may have been deleted on another device." />;
  }
  if (!project.data) {
    if (project.error || project.fetchStatus === 'paused') {
      return <ErrorView error={project.error ?? new ApiError(0, 'NETWORK_ERROR', 'offline')} onRetry={() => void project.refetch()} />;
    }
    return <Loading />;
  }

  const p = project.data;
  const items = tasks.data?.pages.flatMap((page) => page.items) ?? [];
  const edit = () => router.push({ pathname: '/projects/form', params: { id: p.id } });

  const confirmDelete = () =>
    Alert.alert(
      'Delete project?',
      p.taskCount > 0
        ? `“${p.name}” and its ${p.taskCount} ${p.taskCount === 1 ? 'task' : 'tasks'} will be permanently deleted.`
        : `“${p.name}” will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(p.id, {
              onSuccess: () => router.back(),
              onError: (error) => Alert.alert('Could not delete project', errorMessage(error)),
            }),
        },
      ],
    );

  const header = (
    <View style={styles.header}>
      <Card style={styles.summary}>
        <Text style={text.title} accessibilityRole="header">
          {p.name}
        </Text>
        <StatusBadge status={p.status} />
        <Text style={[text.body, { color: p.description ? colors.ink2 : colors.faint }]}>{p.description || 'No description'}</Text>

        <View style={styles.facts}>
          <View style={styles.factRow}>
            <Fact icon="play" label="Start date" value={formatCalendarDate(p.startDate)} />
            <Fact icon="flag" label="End date" value={p.endDate ? formatCalendarDate(p.endDate) : 'No end date'} />
          </View>
          <View style={styles.factRow}>
            <Fact icon="clock" label="Created" value={formatTimestamp(p.createdAt)} />
            <Fact icon="check-square" label="Tasks done" value={`${p.completedTaskCount} of ${p.taskCount}`} />
          </View>
        </View>
        <ProgressBar done={p.completedTaskCount} total={p.taskCount} />

        <View style={styles.actions}>
          <Button label="Edit" icon="edit-2" onPress={edit} style={{ flex: 1 }} />
          <Button label="Delete" icon="trash-2" variant="danger" loading={remove.isPending} onPress={confirmDelete} style={{ flex: 1 }} />
        </View>
      </Card>

      <View style={styles.tasksHeading}>
        <Text style={text.heading} accessibilityRole="header">
          Tasks
        </Text>
        <Button label="Add task" icon="plus" variant="primary" onPress={() => router.push({ pathname: '/tasks/form', params: { projectId: p.id } })} style={{ minHeight: 36 }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <SelectChip
          label="Status"
          icon="filter"
          value={status}
          defaultValue=""
          onChange={setStatus}
          options={[{ value: '' as const, label: 'All statuses' }, ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s], color: statusColors[s].fg }))]}
        />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Project' }} />
      <OfflineBanner />
      <FlatList
        data={items}
        keyExtractor={(task) => task.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={[styles.item, index === 0 && styles.first, index === items.length - 1 && styles.last]}>
            <TaskRow task={item} showProject={false} onPress={() => router.push(`/tasks/${item.id}`)} onToggleComplete={() => toggle(item)} busy={pendingId === item.id} />
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={styles.sepWrap}>
            <Separator />
          </View>
        )}
        onEndReached={() => tasks.hasNextPage && void tasks.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
        ListEmptyComponent={
          tasks.isPending ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
          ) : tasks.error ? (
            <ErrorView error={tasks.error} onRetry={() => void tasks.refetch()} />
          ) : status ? (
            <EmptyState icon="search" title="No results found" description="No tasks with this status." />
          ) : (
            <EmptyState icon="check-square" title="No tasks yet" description="Add a task to start tracking work on this project." />
          )
        }
        contentContainerStyle={{ paddingBottom: space.xxl }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { padding: space.lg, gap: space.md },
  summary: { padding: space.lg, gap: space.md },
  facts: { gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  factRow: { flexDirection: 'row', gap: space.lg },
  fact: { flex: 1, gap: 3 },
  factLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factValue: { fontSize: 15, fontWeight: '500', color: colors.ink },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  tasksHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  item: { marginHorizontal: space.lg, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, overflow: 'hidden', backgroundColor: colors.surface },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  sepWrap: { marginHorizontal: space.lg, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, backgroundColor: colors.surface },
}));
