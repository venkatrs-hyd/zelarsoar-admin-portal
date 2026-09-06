import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'calm' | 'brand' | 'neutral' | 'critical' | 'high' | 'medium' | 'low';

const toneClass: Record<PillTone, string> = {
  calm: 'bg-calm-tint text-calm',
  brand: 'bg-brand-tint text-brand-ink',
  neutral: 'bg-[#F1EEE6] text-ink-3',
  critical: 'bg-sev-critical-tint text-sev-critical-ink',
  high: 'bg-sev-high-tint text-sev-high-ink',
  medium: 'bg-sev-medium-tint text-sev-medium-ink',
  low: 'bg-sev-low-tint text-sev-low-ink',
};

/**
 * StatusPill — calm status pill ("Healthy", "Already sorted", severity variants).
 *   <StatusPill tone="calm" dot>All healthy</StatusPill>
 *   <StatusPill tone="critical">Critical</StatusPill>
 */
export function StatusPill({
  tone = 'neutral',
  dot = false,
  pulse = false,
  children,
  className,
}: {
  tone?: PillTone;
  /** leading 6px dot in currentColor */
  dot?: boolean;
  /** gently pulse the dot (disabled under prefers-reduced-motion) */
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill px-[10px] py-[3px] text-[11.5px] font-semibold leading-[1.4]',
        toneClass[tone],
        className,
      )}
    >
      {(dot || pulse) && (
        <span
          className={cn('h-[6px] w-[6px] flex-none rounded-full bg-current', pulse && 'animate-calm-pulse')}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/** Map a GraphQL Severity enum value to a pill tone. */
export function severityTone(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): PillTone {
  switch (severity) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
  }
}

export default StatusPill;
