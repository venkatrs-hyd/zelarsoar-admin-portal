import { useLocation } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components';
import { getRouteMeta } from '@/lib/routes';

/** Calm "coming in Phase 3" page for /threat-map and /audit-log. */
export default function ComingSoon() {
  const { pathname } = useLocation();
  const meta = getRouteMeta(pathname);
  return (
    <EmptyState
      icon={Compass}
      title={`${meta.title} arrives in Phase 3`}
      message="The shell, gateway contract, and design tokens are already in place — this screen joins the portal in the next phase."
    />
  );
}
