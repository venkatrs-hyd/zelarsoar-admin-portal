import { cn } from '@/lib/utils';

/**
 * LiveBadge — green pulse badge for subscription-backed regions.
 *   <LiveBadge />                    → "Live"
 *   <LiveBadge label="Live feed on" />
 *   <LiveBadge active={false} label="Reconnecting…" />
 */
export function LiveBadge({
  label = 'Live',
  active = true,
  className,
}: {
  label?: string;
  /** false renders the neutral reconnecting variant (no pulse) */
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill px-[10px] py-[3px] text-[11.5px] font-semibold leading-[1.4]',
        active ? 'bg-calm-tint text-calm' : 'bg-sev-low-tint text-sev-low-ink',
        className,
      )}
      aria-live="polite"
    >
      <span
        className={cn('h-[6px] w-[6px] flex-none rounded-full bg-current', active && 'animate-calm-pulse')}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export default LiveBadge;
