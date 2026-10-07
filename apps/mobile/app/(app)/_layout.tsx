import { Stack } from 'expo-router';
import { RemindersProvider } from '../../src/lib/reminders';
import { useTheme } from '../../src/lib/theme-context';

/** Signed-in area: bottom tabs, plus stacked detail screens pushed on top of them. */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <RemindersProvider>
      <Stack
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.paper },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="projects/[id]" options={{ title: 'Project' }} />
        <Stack.Screen name="tasks/[id]" options={{ title: 'Task' }} />
        <Stack.Screen name="tasks/form" options={{ presentation: 'modal', title: 'Task' }} />
        <Stack.Screen name="projects/form" options={{ presentation: 'modal', title: 'Project' }} />
      </Stack>
    </RemindersProvider>
  );
}
