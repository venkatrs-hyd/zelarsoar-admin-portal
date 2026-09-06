import { useLocation } from 'react-router';
import { Hammer } from 'lucide-react';
import { EmptyState } from '@/components';
import { getRouteMeta } from '@/lib/routes';

/**
 * Route stub — page agents replace this by creating the real page file and
 * pointing App.tsx at it. Renders the route title in a calm EmptyState.
 */
export default function Placeholder() {
  const { pathname } = useLocation();
  const meta = getRouteMeta(pathname);
  return (
    <EmptyState
      icon={Hammer}
      tone="neutral"
      title={`${meta.title} is being built`}
      message="This screen is wired into the shell and the GraphQL gateway is ready. The page lands in the next build pass."
    />
  );
}
