import { CheckSquare, FolderKanban, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';
import { cn, firstName } from '../lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Shown only to admins (the route and the API check the role too). */
const ADMIN_NAV = { to: '/admin', label: 'Admin', icon: ShieldCheck };

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {(user?.role === 'ADMIN' ? [...NAV, ADMIN_NAV] : NAV).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-base transition-colors duration-150',
                    isActive ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-4', isActive ? 'text-accent' : 'text-muted')} aria-hidden />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-line p-2">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
            {user?.fullName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user ? firstName(user.fullName) : ''}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            setSigningOut(true);
            await logout();
          }}
          disabled={signingOut}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-base text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:opacity-60"
        >
          <LogOut className="size-4 text-muted" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

/**
 * Desktop (≥1024px): fixed 232px sidebar. Smaller screens: a top bar whose menu button
 * opens the same navigation as a drawer.
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh lg:pl-58">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-58 border-r border-line bg-paper lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur-sm lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-paper shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Suspense fallback={<div role="status" aria-label="Loading" className="h-40" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
