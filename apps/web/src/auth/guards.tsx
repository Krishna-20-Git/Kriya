import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ErrorState } from '../components/ui/States';
import { useAuth } from './AuthProvider';

function FullPageStatus() {
  const { bootError, retryBoot } = useAuth();
  if (bootError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState error={bootError} onRetry={retryBoot} />
      </div>
    );
  }
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <LoaderCircle className="size-6 animate-spin text-faint motion-reduce:animate-none" aria-hidden />
    </div>
  );
}

/** Wraps every page that needs a session. Unauthenticated visitors go to /login and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageStatus />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Login and register are only for signed-out visitors. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageStatus />;
  if (status === 'authenticated') {
    // After signing in, go back to the page that sent the visitor to /login.
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from?.startsWith('/') ? from : '/dashboard'} replace />;
  }
  return <Outlet />;
}

/**
 * Admin-only pages. Non-admins see the 404 page rather than a "forbidden" message, so the admin
 * area is not advertised. This is a UX guard only — the API enforces the role on every request.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <NotFoundPage />;
  return children;
}
