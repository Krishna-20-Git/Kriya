import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, USER_ROLES, USER_ROLE_LABELS, formatTimestamp, type AdminUser, type AuditAction, type UserRole } from '@pms/shared';
import { History, ShieldCheck, Users } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { SearchInput } from '../components/TaskFilters';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Select } from '../components/ui/Field';
import { Pagination, usePageClamp } from '../components/ui/Pagination';
import { EmptyState, ErrorState, Panel, PanelHeader, SkeletonRows } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { ApiError, errorMessage } from '../lib/api';
import { useAdminAuditLog, useAdminUsers, useChangeRole } from '../lib/queries';
import { cn } from '../lib/utils';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm font-medium',
        role === 'ADMIN' ? 'bg-accent-soft text-accent' : 'bg-pending-soft text-pending',
      )}
    >
      {role === 'ADMIN' ? <ShieldCheck className="size-3.5" aria-hidden /> : null}
      {USER_ROLE_LABELS[role]}
    </span>
  );
}

interface PendingChange {
  user: AdminUser;
  role: UserRole;
}

function UsersPanel({ onShowActivity }: { onShowActivity: (user: AdminUser) => void }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [role, setRole] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);
  const users = useAdminUsers({ search: deferredSearch, role, page });
  usePageClamp(users.data?.meta, setPage);
  const changeRole = useChangeRole();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setError(null);
    try {
      await changeRole.mutateAsync({ id: pending.user.id, role: pending.role });
      toast(`${pending.user.fullName} is now ${pending.role === 'ADMIN' ? 'an admin' : 'a regular user'}`);
      setPending(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const roleControl = (u: AdminUser) => {
    const isMe = u.id === me?.id;
    return (
      <Select
        aria-label={`Role for ${u.fullName}`}
        value={u.role}
        disabled={isMe}
        title={isMe ? 'You can’t change your own role' : undefined}
        onChange={(e) => setPending({ user: u, role: e.target.value as UserRole })}
        className="w-28"
      >
        {USER_ROLES.map((r) => (
          <option key={r} value={r}>
            {USER_ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
    );
  };

  return (
    <Panel>
      <PanelHeader title="Users" description="Accounts and their activity. Admins can’t open other users’ projects or tasks." />
      <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          label="Search name or email"
        />
        <Select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as UserRole | '');
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {USER_ROLE_LABELS[r]}s
            </option>
          ))}
        </Select>
      </div>

      {users.isPending ? (
        <SkeletonRows rows={4} />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title="No users found" description="Try a different search or role." />
      ) : (
        <>
          <table className="hidden w-full table-fixed text-left md:table">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="py-2.5 pr-4 pl-4 font-medium">User</th>
                <th scope="col" className="w-36 py-2.5 pr-4 font-medium">Role</th>
                <th scope="col" className="w-24 py-2.5 pr-4 text-right font-medium">Projects</th>
                <th scope="col" className="w-20 py-2.5 pr-4 text-right font-medium">Tasks</th>
                <th scope="col" className="hidden w-32 py-2.5 pr-4 font-medium xl:table-cell">Joined</th>
                <th scope="col" className="hidden w-36 py-2.5 pr-4 font-medium lg:table-cell">Last active</th>
                <th scope="col" className="w-24 py-2.5 pr-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.data.items.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 pl-4">
                    <p className="truncate font-medium">
                      {u.fullName}
                      {u.id === me?.id ? <span className="ml-1.5 text-sm font-normal text-muted">(you)</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4">{roleControl(u)}</td>
                  <td className="tabular py-3 pr-4 text-right">{u.projectCount}</td>
                  <td className="tabular py-3 pr-4 text-right">{u.taskCount}</td>
                  <td className="tabular hidden py-3 pr-4 text-sm text-ink-2 xl:table-cell">{formatTimestamp(u.createdAt)}</td>
                  <td className="tabular hidden py-3 pr-4 text-sm text-muted lg:table-cell">{u.lastActiveAt ? formatTimestamp(u.lastActiveAt) : 'Never'}</td>
                  <td className="py-3 pr-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onShowActivity(u)}>
                      Activity
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Below 768 px: stacked rows instead of a squeezed table. */}
          <ul className="divide-y divide-line md:hidden">
            {users.data.items.map((u) => (
              <li key={u.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.fullName}
                      {u.id === me?.id ? <span className="ml-1.5 text-sm font-normal text-muted">(you)</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <p className="tabular text-sm text-muted">
                  {u.projectCount} projects · {u.taskCount} tasks · last active {u.lastActiveAt ? formatTimestamp(u.lastActiveAt) : 'never'}
                </p>
                <div className="flex items-center gap-2">
                  {roleControl(u)}
                  <Button size="sm" variant="ghost" onClick={() => onShowActivity(u)}>
                    Activity
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination meta={users.data.meta} noun="users" onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        tone={pending?.role === 'ADMIN' ? 'primary' : 'danger'}
        title={pending?.role === 'ADMIN' ? 'Make this user an admin?' : 'Remove admin access?'}
        message={
          pending?.role === 'ADMIN'
            ? `${pending.user.fullName} will be able to see all accounts, change roles and read the full audit log.`
            : `${pending?.user.fullName ?? ''} will lose access to the admin area immediately.`
        }
        confirmLabel={pending?.role === 'ADMIN' ? 'Make admin' : 'Remove admin'}
        pending={changeRole.isPending}
        error={error}
        onConfirm={() => void confirm()}
        onClose={() => {
          setPending(null);
          setError(null);
        }}
      />
    </Panel>
  );
}

function AuditPanel({ user, onClearUser }: { user: AdminUser | null; onClearUser: () => void }) {
  const [action, setAction] = useState<AuditAction | ''>('');
  const [page, setPage] = useState(1);
  const log = useAdminAuditLog({ userId: user?.id, action, page });
  usePageClamp(log.data?.meta, setPage);

  return (
    <Panel>
      <PanelHeader
        title="Audit log"
        description={user ? `Activity by ${user.fullName}` : 'Sign-ins, changes and role updates across all accounts'}
        action={
          user ? (
            <Button size="sm" variant="ghost" onClick={onClearUser}>
              Show everyone
            </Button>
          ) : null
        }
      />
      <div className="border-b border-line p-3">
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value as AuditAction | '');
            setPage(1);
          }}
          className="sm:w-60"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
      </div>
      {log.isPending ? (
        <SkeletonRows rows={5} />
      ) : log.error ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : log.data.items.length === 0 ? (
        <EmptyState icon={<History className="size-5" aria-hidden />} title="No entries" description="Nothing matches this filter yet." />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {log.data.items.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-base">
                    <span className="font-medium">{entry.actor.fullName}</span> <span className="text-ink-2">{AUDIT_ACTION_LABELS[entry.action].toLowerCase()}</span>
                    {entry.entityName ? <span className="text-ink-2"> · {entry.entityName}</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{entry.actor.email}</p>
                </div>
                <time dateTime={entry.createdAt} className="tabular shrink-0 text-sm text-muted sm:text-right">
                  {formatTimestamp(entry.createdAt)}, {timeFormat.format(new Date(entry.createdAt))}
                </time>
              </li>
            ))}
          </ul>
          <Pagination meta={log.data.meta} noun="entries" onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}

/** Admin area: only reachable with role ADMIN (route guard here, enforced again by the API). */
export function AdminPage() {
  const [activityFor, setActivityFor] = useState<AdminUser | null>(null);
  const { refreshUser } = useAuth();
  const probe = useAdminUsers({ search: '', role: '', page: 1 }); // same key as the Users panel's first page, so no extra request
  // Demoted while on this page: the API now answers 403, so re-read the role and the guard
  // replaces the page with "not found" (and the Admin link disappears).
  useEffect(() => {
    if (probe.error instanceof ApiError && probe.error.status === 403) void refreshUser();
  }, [probe.error, refreshUser]);
  return (
    <>
      <PageHeader title="Admin" description="Manage accounts and roles, and review activity across the system." />
      <div className="flex flex-col gap-6">
        <UsersPanel
          onShowActivity={(user) => {
            setActivityFor(user);
            document.getElementById('audit-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        <div id="audit-log" className="scroll-mt-6">
          <AuditPanel user={activityFor} onClearUser={() => setActivityFor(null)} />
        </div>
      </div>
    </>
  );
}
