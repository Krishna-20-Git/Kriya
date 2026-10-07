import { Compass } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage({ resource }: { resource?: 'project' }) {
  const title = resource === 'project' ? 'Project not found' : 'Page not found';
  const description =
    resource === 'project'
      ? 'This project doesn’t exist or you don’t have access to it.'
      : 'The page you’re looking for doesn’t exist or has moved.';
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-sunken text-muted" aria-hidden>
        <Compass className="size-5" />
      </div>
      <p className="tabular text-sm font-medium text-muted">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-sm text-base text-muted">{description}</p>
      <Link
        to={resource === 'project' ? '/projects' : '/dashboard'}
        className="mt-6 inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 font-medium hover:bg-sunken"
      >
        {resource === 'project' ? 'Back to projects' : 'Go to dashboard'}
      </Link>
    </div>
  );
}
