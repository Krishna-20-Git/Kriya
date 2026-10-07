import { Feather } from '@expo/vector-icons';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from '@pms/shared';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FilterRow, SearchField, SelectChip } from '../../../src/components/filters';
import { useDebounced, usePullToRefresh, useToggleComplete } from '../../../src/components/hooks';
import { Separator, TaskRow } from '../../../src/components/rows';
import { ErrorView, Loading, OfflineBanner } from '../../../src/components/states';
import { EmptyState } from '../../../src/components/ui';
import { ApiError } from '../../../src/lib/api';
import { useTaskList, type TaskFilters } from '../../../src/lib/queries';
import { radius, space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

const SORTS = {
  newest: { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  due: { label: 'Due date (soonest)', sortBy: 'dueDate', sortOrder: 'asc' },
  priority: { label: 'Priority (high first)', sortBy: 'priority', sortOrder: 'desc' },
  name: { label: 'Name (A–Z)', sortBy: 'name', sortOrder: 'asc' },
  oldest: { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
} as const satisfies Record<string, { label: string; sortBy: NonNullable<TaskFilters['sortBy']>; sortOrder: NonNullable<TaskFilters['sortOrder']> }>;
type SortKey = keyof typeof SORTS;

export default function TasksScreen() {
  const styles = useStyles();
  const { colors, statusColors, priorityColors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [sort, setSort] = useState<SortKey>('newest');
  const debounced = useDebounced(search.trim());
  const { sortBy, sortOrder } = SORTS[sort];

  // Search, filters and sorting run on the server, so they work across all pages of results.
  const tasks = useTaskList({ search: debounced, status, priority, sortBy, sortOrder });
  const { refreshing, onRefresh } = usePullToRefresh(['tasks']);
  const { toggle, pendingId } = useToggleComplete();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/tasks/form')} accessibilityRole="button" accessibilityLabel="New task" hitSlop={8} style={{ paddingHorizontal: space.lg }}>
          <Feather name="plus" size={24} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation, router, colors.accent]);

  const items = tasks.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = debounced !== '' || status !== '' || priority !== '';
  const total = tasks.data?.pages[0]?.meta.total;
  const summary = total === undefined ? undefined : `${total} ${total === 1 ? 'task' : 'tasks'}${filtered ? ' found' : ''}`;
  const clearAll = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setSort('newest');
  };

  const body = () => {
    if (tasks.data) {
      return (
        <FlatList
          data={items}
          keyExtractor={(task) => task.id}
          renderItem={({ item }) => (
            <TaskRow task={item} onPress={() => router.push(`/tasks/${item.id}`)} onToggleComplete={() => toggle(item)} busy={pendingId === item.id} />
          )}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
          onEndReached={() => tasks.hasNextPage && !tasks.isFetchingNextPage && void tasks.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={tasks.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} color={colors.accent} /> : null}
          contentContainerStyle={items.length ? styles.list : { flexGrow: 1 }}
          style={items.length ? styles.listBox : undefined}
          ListEmptyComponent={
            filtered ? (
              <EmptyState icon="search" title="No results found" description="Try adjusting your search or filters." />
            ) : (
              <EmptyState icon="check-square" title="No tasks found" description="Create a task to start tracking your work." />
            )
          }
        />
      );
    }
    if (tasks.error) return <ErrorView error={tasks.error} onRetry={() => void tasks.refetch()} />;
    if (tasks.fetchStatus === 'paused') return <ErrorView error={new ApiError(0, 'NETWORK_ERROR', 'offline')} onRetry={() => void tasks.refetch()} />;
    return <Loading />;
  };

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={styles.controls}>
        <SearchField value={search} onChange={setSearch} placeholder="Search tasks" />
        <FilterRow summary={summary} onClear={filtered || sort !== 'newest' ? clearAll : undefined}>
          <SelectChip
            label="Status"
            icon="filter"
            value={status}
            defaultValue=""
            onChange={setStatus}
            options={[{ value: '' as const, label: 'All statuses' }, ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s], color: statusColors[s].fg }))]}
          />
          <SelectChip
            label="Priority"
            value={priority}
            defaultValue=""
            onChange={setPriority}
            options={[{ value: '' as const, label: 'All priorities' }, ...TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p], color: priorityColors[p] }))]}
          />
          <SelectChip
            label="Sort"
            icon="arrow-down"
            value={sort}
            defaultValue="newest"
            onChange={setSort}
            options={(Object.keys(SORTS) as SortKey[]).map((key) => ({ value: key, label: SORTS[key].label }))}
          />
        </FilterRow>
      </View>
      {body()}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  controls: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.md },
  listBox: { marginHorizontal: space.lg },
  list: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, marginBottom: space.xl },
}));
