import { Feather } from '@expo/vector-icons';
import { formatCalendarDate, isOverdue, type Project, type Task } from '@pms/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';
import { DueText, PriorityBadge, StatusBadge } from './badges';
import { ProgressBar } from './ui';

export function TaskRow({
  task,
  onPress,
  onToggleComplete,
  showProject = true,
  busy = false,
}: {
  task: Task;
  onPress: () => void;
  onToggleComplete?: () => void;
  showProject?: boolean;
  busy?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const done = task.status === 'COMPLETED';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.name}, ${task.status.replace('_', ' ').toLowerCase()}, ${task.priority.toLowerCase()} priority`}
      accessibilityHint="Opens task details"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.paper }]}
    >
      {onToggleComplete ? (
        <Pressable
          onPress={onToggleComplete}
          disabled={busy}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, disabled: busy }}
          accessibilityLabel={done ? `Reopen ${task.name}` : `Mark ${task.name} as completed`}
          style={[styles.check, done && { backgroundColor: colors.done, borderColor: colors.done }, busy && { opacity: 0.5 }]}
        >
          {done ? <Feather name="check" size={14} color={colors.onAccent} /> : null}
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.name}
        </Text>
        <View style={styles.subRow}>
          {showProject ? (
            <>
              <Text style={[styles.sub, { flexShrink: 1, marginTop: 0 }]} numberOfLines={1}>
                {task.project.name}
              </Text>
              <Text style={styles.sub}> · </Text>
            </>
          ) : null}
          <View style={styles.due}>
            <Feather name="calendar" size={12} color={isOverdue(task.dueDate, done) ? colors.danger : colors.muted} />
            <DueText value={task.dueDate} completed={done} />
          </View>
        </View>
        <View style={styles.meta}>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </View>
      </View>
    </Pressable>
  );
}

/** "Oct 1 – Nov 30, 2026", "From Oct 1, 2026" — the project's date range on one line. */
export function projectDateRange(project: Pick<Project, 'startDate' | 'endDate'>) {
  if (!project.endDate) return `From ${formatCalendarDate(project.startDate)}`;
  return `${formatCalendarDate(project.startDate)} – ${formatCalendarDate(project.endDate)}`;
}

export function ProjectRow({ project, onPress }: { project: Project; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${project.status.replace('_', ' ').toLowerCase()}, ${project.completedTaskCount} of ${project.taskCount} tasks completed`}
      accessibilityHint="Opens project details"
      style={({ pressed }) => [styles.row, { alignItems: 'flex-start' }, pressed && { backgroundColor: colors.paper }]}
    >
      <View style={[styles.body, { gap: 6 }]}>
        <Text style={styles.title} numberOfLines={2}>
          {project.name}
        </Text>
        {project.description ? (
          <Text style={styles.sub} numberOfLines={1}>
            {project.description}
          </Text>
        ) : null}
        <View style={styles.projectMeta}>
          <StatusBadge status={project.status} />
          <View style={styles.dateMeta}>
            <Feather name="calendar" size={13} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {projectDateRange(project)}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 2 }}>
          <ProgressBar done={project.completedTaskCount} total={project.taskCount} suffix="tasks" />
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.faint} style={{ marginTop: 2 }} />
    </Pressable>
  );
}

export function Separator() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: space.lg }} />;
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: colors.surface },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '500', color: colors.ink },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, minWidth: 0 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  projectMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  dateMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 13, color: colors.muted },
}));
