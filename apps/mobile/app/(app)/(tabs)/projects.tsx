import { Feather } from '@expo/vector-icons';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from '@pms/shared';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FilterRow, SearchField, SelectChip } from '../../../src/components/filters';
import { useDebounced, usePullToRefresh } from '../../../src/components/hooks';
import { ProjectRow, Separator } from '../../../src/components/rows';
import { OfflineBanner, QueryView } from '../../../src/components/states';
import { Button, EmptyState } from '../../../src/components/ui';
import { useProjects, type ProjectFilters } from '../../../src/lib/queries';
import { radius, space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

const SORTS = {
  newest: { label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  name: { label: 'Name (A–Z)', sortBy: 'name', sortOrder: 'asc' },
  start: { label: 'Start date', sortBy: 'startDate', sortOrder: 'asc' },
  end: { label: 'End date', sortBy: 'endDate', sortOrder: 'asc' },
} as const satisfies Record<string, { label: string; sortBy: ProjectFilters['sortBy']; sortOrder: ProjectFilters['sortOrder'] }>;
type SortKey = keyof typeof SORTS;

export default function ProjectsScreen() {
  const styles = useStyles();
  const { colors, statusColors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [sort, setSort] = useState<SortKey>('newest');
  const debounced = useDebounced(search.trim());
  const { sortBy, sortOrder } = SORTS[sort];
  const projects = useProjects({ search: debounced, status, sortBy, sortOrder });
  const { refreshing, onRefresh } = usePullToRefresh(['projects']);
  const filtered = debounced !== '' || status !== '';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/projects/form')} accessibilityRole="button" accessibilityLabel="New project" hitSlop={8} style={{ paddingHorizontal: space.lg }}>
          <Feather name="plus" size={24} color={colors.accent} />
        </Pressable>
      ),
    });
  }, [navigation, router, colors.accent]);

  const count = projects.data?.length;
  const summary = count === undefined ? undefined : `${count} ${count === 1 ? 'project' : 'projects'}${filtered ? ' found' : ''}`;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={styles.controls}>
        <SearchField value={search} onChange={setSearch} placeholder="Search projects" />
        <FilterRow
          summary={summary}
          onClear={
            filtered || sort !== 'newest'
              ? () => {
                  setSearch('');
                  setStatus('');
                  setSort('newest');
                }
              : undefined
          }
        >
          <SelectChip
            label="Status"
            icon="filter"
            value={status}
            defaultValue=""
            onChange={setStatus}
            options={[{ value: '' as const, label: 'All statuses' }, ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s], color: statusColors[s].fg }))]}
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
      <QueryView query={projects}>
        {(items) => (
          <FlatList
            data={items}
            keyExtractor={(project) => project.id}
            renderItem={({ item }) => <ProjectRow project={item} onPress={() => router.push(`/projects/${item.id}`)} />}
            ItemSeparatorComponent={Separator}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
            contentContainerStyle={items.length ? styles.list : { flexGrow: 1 }}
            style={items.length ? styles.listBox : undefined}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              filtered ? (
                <EmptyState icon="search" title="No results found" description="Try a different search or status." />
              ) : (
                <EmptyState
                  icon="folder"
                  title="No projects yet"
                  description="Create your first project to start organizing your work."
                  action={<Button label="Create project" icon="plus" variant="primary" onPress={() => router.push('/projects/form')} />}
                />
              )
            }
          />
        )}
      </QueryView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  controls: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.md },
  listBox: { marginHorizontal: space.lg },
  list: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong, marginBottom: space.xl },
}));
