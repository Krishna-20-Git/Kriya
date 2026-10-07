import { AUDIT_ACTION_LABELS, USER_ROLE_LABELS, formatTimestamp } from '@pms/shared';
import { History, LogOut, Monitor, MonitorSmartphone, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, Panel, PanelHeader, SkeletonRows } from '../components/ui/States';
import { errorMessage } from '../lib/api';
import { useActivity } from '../lib/queries';
import { useTheme, type ThemePreference } from '../lib/theme';
import { cn } from '../lib/utils';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Segmented Light / Dark / System control. A native radio group, so arrow keys and screen readers work. */
function AppearancePanel() {
  const { preference, setPreference } = useTheme();
  return (
    <Panel>
      <PanelHeader title="Appearance" description="System follows your device’s light or dark setting." />
      <div className="p-4">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-sunken p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = preference === value;
            return (
              <label
                key={value}
                className={cn(
                  'flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md text-base font-medium transition-colors duration-150',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                  selected ? 'bg-surface text-ink shadow-[0_1px_2px_var(--color-shadow)]' : 'text-muted hover:text-ink',
                )}
              >
                <input type="radio" name="theme" value={value} checked={selected} onChange={() => setPreference(value)} className="sr-only" />
                <Icon className="size-4" aria-hidden />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function SettingsPage() {
  const { user, logout, logoutEverywhere } = useAuth();
  const activity = useActivity();
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Settings" description="Your account, sessions and recent activity." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AppearancePanel />
          <Panel>
            <PanelHeader title="Profile" />
            <dl className="divide-y divide-line">
              {[
                ['Full name', user?.fullName],
                ['Email', user?.email],
                ['Role', user ? USER_ROLE_LABELS[user.role] : ''],
                ['Member since', formatTimestamp(user?.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="font-medium break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Sessions" description="The same account is used on the web and in the Android app." />
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">Sign out of this browser</p>
                  <p className="text-sm text-muted">Your other devices stay signed in.</p>
                </div>
                <Button onClick={() => logout()} icon={<LogOut className="size-4" aria-hidden />}>
                  Sign out
                </Button>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
                <div>
                  <p className="font-medium">Sign out everywhere</p>
                  <p className="text-sm text-muted">Ends every session, including the mobile app. Use this if a device is lost.</p>
                </div>
                <Button onClick={() => setConfirmAll(true)} icon={<MonitorSmartphone className="size-4" aria-hidden />}>
                  Sign out all
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="self-start">
          <PanelHeader title="Recent activity" description="Recorded by the server’s audit log" />
          {activity.isPending ? (
            <SkeletonRows rows={6} />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => activity.refetch()} compact />
          ) : activity.data.length === 0 ? (
            <EmptyState icon={<History className="size-5" />} title="No activity yet" description="Changes you make will be listed here." />
          ) : (
            <ol className="divide-y divide-line">
              {activity.data.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <p className="min-w-0 text-base">
                    {AUDIT_ACTION_LABELS[entry.action]}
                    {entry.entityName ? <span className="font-medium"> {entry.entityName}</span> : null}
                  </p>
                  <time dateTime={entry.createdAt} className="tabular shrink-0 text-sm text-muted">
                    {formatTimestamp(entry.createdAt)}, {timeFormat.format(new Date(entry.createdAt))}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmAll}
        title="Sign out everywhere?"
        message="You will be signed out on this browser and on every other device, including the Android app."
        confirmLabel="Sign out everywhere"
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(null);
          try {
            await logoutEverywhere();
          } catch (err) {
            setError(errorMessage(err));
            setPending(false);
          }
        }}
        onClose={() => setConfirmAll(false)}
      />
    </>
  );
}
