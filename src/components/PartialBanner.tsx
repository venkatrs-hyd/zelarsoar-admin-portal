import { TriangleAlert } from 'lucide-react';

/**
 * PartialBanner — calm inline banner when a sub-field failed but the rest
 * of the region rendered (errorPolicy: 'all').
 *   <PartialBanner
 *     title="Threat origins unavailable"
 *     field="threatIntel.geoOrigins"
 *     onRetry={() => refetch()}
 *   />
 */
export function PartialBanner({
  title,
  field,
  message,
  onRetry,
}: {
  title: string;
  /** mono name of the failed field, e.g. "threatIntel.geoOrigins" */
  field?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-[10px] rounded-card border border-[#EBD9BC] bg-sev-high-tint px-[14px] py-3 text-sev-high-ink"
      role="alert"
    >
      <TriangleAlert size={15} strokeWidth={2} className="mt-[1px] shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px]">
          {message ?? (
            <>
              {field ? (
                <>
                  Field <span className="mono text-[11px]">{field}</span> failed to resolve.{' '}
                </>
              ) : null}
              Everything else on this page is unaffected.
            </>
          )}
        </p>
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm mt-2.5" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default PartialBanner;
