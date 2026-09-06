import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '@/components';

export default function NotFound() {
  return (
    <EmptyState
      icon={MapPinOff}
      tone="neutral"
      title="This page isn’t part of the portal"
      message="The address doesn’t match any screen. Nothing is broken — head back to the dashboard."
      action={
        <Link to="/" className="btn btn-primary">
          Back to dashboard
        </Link>
      }
    />
  );
}
