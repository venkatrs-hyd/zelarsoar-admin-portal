import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import Card from './Card';

/**
 * ErrorCard — full-failure boundary card with calm copy + retry.
 *   <ErrorCard
 *     title="The alerts didn't load"
 *     message="Something went wrong while fetching alerts. Your data is safe."
 *     traceId="7f3a9c"
 *     onRetry={() => refetch()}
 *   />
 */
export function ErrorCard({
  title = 'This section didn’t load',
  message = 'Something went wrong while talking to the gateway. Your data is safe — this is a display problem, not an incident.',
  traceId,
  onRetry,
  retryLabel = 'Retry',
  boundary,
}: {
  title?: string;
  message?: ReactNode;
  traceId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** name of the error boundary that caught it, shown in the trace line */
  boundary?: string;
}) {
  return (
    <Card className="mx-auto max-w-[560px] p-8 text-center sm:p-12" role="alert">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sev-high-tint text-sev-high-ink">
        <TriangleAlert size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h2 className="font-display mt-4 text-[18px] font-semibold">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{message}</p>
      {(traceId || boundary) && (
        <p className="mono mt-3 text-[11px] text-ink-3">
          {traceId ? `trace ${traceId}` : ''}
          {traceId && boundary ? ' · ' : ''}
          {boundary ? `error boundary: <${boundary}>` : ''}
        </p>
      )}
      {onRetry && (
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      )}
    </Card>
  );
}

export default ErrorCard;
