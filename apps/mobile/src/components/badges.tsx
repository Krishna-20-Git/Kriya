import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  describeDueDate,
  isOverdue,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@pms/shared';
import { Text, View } from 'react-native';
import { makeStyles, useTheme } from '../lib/theme-context';

export function StatusBadge({ status }: { status: ProjectStatus | TaskStatus }) {
  const styles = useStyles();
  const { statusColors } = useTheme();
  const c = statusColors[status];
  const label = status in PROJECT_STATUS_LABELS ? PROJECT_STATUS_LABELS[status as ProjectStatus] : TASK_STATUS_LABELS[status as TaskStatus];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles = useStyles();
  const { priorityColors } = useTheme();
  const bars = { LOW: 1, MEDIUM: 2, HIGH: 3 }[priority];
  const color = priorityColors[priority];
  return (
    <View style={styles.priority} accessible accessibilityLabel={`${TASK_PRIORITY_LABELS[priority]} priority`}>
      <View style={styles.bars}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 1, backgroundColor: color, opacity: i < bars ? 1 : 0.22 }} />
        ))}
      </View>
      <Text style={[styles.badgeText, { color }]}>{TASK_PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

export function DueText({ value, completed }: { value: string | null; completed: boolean }) {
  const { colors } = useTheme();
  const overdue = isOverdue(value, completed);
  return (
    <Text numberOfLines={1} style={{ fontSize: 13, color: overdue ? colors.danger : value ? colors.ink2 : colors.faint, fontWeight: overdue ? '600' : '400' }}>
      {describeDueDate(value, completed)}
    </Text>
  );
}

const useStyles = makeStyles(() => ({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 10 },
}));
