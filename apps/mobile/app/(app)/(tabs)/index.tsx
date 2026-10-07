import { TASK_STATUS_LABELS, type Dashboard } from '@pms/shared';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DueText, PriorityBadge} from '../../../src/components/badges';
import { usePullToRefresh } from '../../../src/components/hooks';
import { ProjectRow, Separator } from '../../../src/components/rows';
import { OfflineBanner, QueryView } from '../../../src/components/states';
import { Button, Card, EmptyState, SectionHeader } from '../../../src/components/ui';
import { useAuth } from '../../../src/lib/auth';
import { useDashboard } from '../../../src/lib/queries';
import { radius, space } from '../../../src/lib/theme';
import { makeStyles, useTheme } from '../../../src/lib/theme-context';

function Stat({ label, value, note, alert }: { label: string; value: number; note?: string; alert?: boolean }) {
  const styles = useStyles();
  const { colors, text } = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}>
      <Text style={text.small}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={[text.small, alert && { color: colors.danger, fontWeight: '600' }]}>{note}</Text> : null}
    </View>
  );
}

function StatusBar({ d }: { d: Dashboard }) {
  const styles = useStyles();
  const { colors, text, statusColors } = useTheme();
  const segments = (['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => ({ status, value: d.taskStatusDistribution[status] }));
  const total = d.totalTasks || 1;
  return (
    <View>
      <View style={styles.bar} accessible accessibilityLabel={segments.map((s) => `${s.value} ${TASK_STATUS_LABELS[s.status]}`).join(', ')}>
        {segments.map((s) => (s.value ? <View key={s.status} style={{ flex: s.value / total, backgroundColor: statusColors[s.status].fg }} /> : null))}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: statusColors[s.status].fg }]} />
            <Text style={text.small}>
              {TASK_STATUS_LABELS[s.status]} <Text style={{ color: colors.ink, fontWeight: '600' }}>{s.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors, text } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const dashboard = useDashboard();
  const { refreshing, onRefresh } = usePullToRefresh(['dashboard']);
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} tintColor={colors.accent} />}
      >
        <Text style={text.title} accessibilityRole="header">
          Welcome, {firstName}
        </Text>
        <Text style={[text.small, { fontSize: 15, marginTop: 2, marginBottom: space.lg }]}>Here’s an overview of your projects and tasks.</Text>

        <QueryView query={dashboard}>
          {(d) =>
            d.totalProjects === 0 ? (
              <Card>
                <EmptyState
                  icon="folder-plus"
                  title="No projects yet"
                  description="Create your first project to start organizing your work."
                  action={<Button label="Create project" icon="plus" variant="primary" onPress={() => router.push('/projects/form')} />}
                />
              </Card>
            ) : (
              <View style={{ gap: space.xl }}>
                <Card style={styles.statGrid}>
                  <View style={styles.statRow}>
                    <Stat label="Total projects" value={d.totalProjects} note={`${d.projectsInProgress} in progress`} />
                    <View style={styles.vRule} />
                    <Stat label="Total tasks" value={d.totalTasks} note={d.overdueTasks ? `${d.overdueTasks} overdue` : 'None overdue'} alert={d.overdueTasks > 0} />
                  </View>
                  <View style={styles.hRule} />
                  <View style={styles.statRow}>
                    <Stat label="Completed" value={d.completedTasks} />
                    <View style={styles.vRule} />
                    <Stat label="Pending" value={d.pendingTasks} note={`${d.inProgressTasks} in progress`} />
                  </View>
                  <View style={styles.hRule} />
                  <View style={[styles.statPad, { paddingTop: space.md }]}>
                    <StatusBar d={d} />
                  </View>
                </Card>

                <View>
                  <SectionHeader title="Recent projects" />
                  <Card style={{ overflow: 'hidden' }}>
                    {d.recentProjects.map((project, index) => (
                      <View key={project.id}>
                        {index > 0 ? <Separator /> : null}
                        <ProjectRow project={project} onPress={() => router.push(`/projects/${project.id}`)} />
                      </View>
                    ))}
                  </Card>
                </View>

                <View>
                  <SectionHeader title="Due soon" />
                  <Card style={{ overflow: 'hidden' }}>
                    {d.upcomingTasks.length === 0 ? (
                      <EmptyState icon="calendar" title="Nothing due" description="Open tasks with a due date will show up here." />
                    ) : (
                      d.upcomingTasks.map((task, index) => (
                        <View key={task.id}>
                          {index > 0 ? <Separator /> : null}
                          <Pressable
                            onPress={() => router.push(`/tasks/${task.id}`)}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.dueRow, pressed && { backgroundColor: colors.paper }]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.dueTitle} numberOfLines={1}>
                                {task.name}
                              </Text>
                              <Text style={text.small} numberOfLines={1}>
                                {task.project.name}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <DueText value={task.dueDate} completed={false} />
                              <PriorityBadge priority={task.priority} />
                            </View>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </Card>
                </View>

                <Button label="New task" icon="plus" variant="primary" onPress={() => router.push('/tasks/form')} />
              </View>
            )
          }
        </QueryView>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { padding: space.lg, paddingBottom: space.xxl },
  statGrid: { paddingVertical: space.xs },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, padding: space.lg, gap: 2 },
  statPad: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  statValue: { fontSize: 28, lineHeight: 34, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  vRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  hRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  bar: { flexDirection: 'row', height: 8, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.sunken, gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12 },
  dueTitle: { fontSize: 15, fontWeight: '500', color: colors.ink },
}));
