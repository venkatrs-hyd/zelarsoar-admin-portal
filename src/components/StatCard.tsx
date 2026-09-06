import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Card from './Card';
import Skeleton from './Skeleton';

/**
 * StatCard — KPI card (label / big value / calm subline).
 *   <StatCard label="Tenants" value="8" sub="All healthy" subTone="calm" subDot />
 *   <StatCard label="Alerts · last 24h" value="1,284" sub="12% quieter than yesterday" subTone="calm" />
 */
export function StatCard({
  label,
  value,
  sub,
  subTone = 'muted',
  subDot = false,
  subIcon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** calm = green text, muted = ink-3 */
  subTone?: 'calm' | 'muted';
  /** show the small leading dot before the subline */
  subDot?: boolean;
  subIcon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-[12px] font-medium text-ink-3">{label}</p>
      <p className="font-display mt-1 text-[28px] font-semibold leading-tight">{value}</p>
      {sub != null && (
        <p
          className={cn(
            'mt-1 flex items-center gap-1.5 text-[12px]',
            subTone === 'calm' ? 'font-medium text-calm' : 'text-ink-3',
          )}
        >
          {subDot && <span className="h-[6px] w-[6px] flex-none rounded-full bg-current" aria-hidden="true" />}
          {subIcon}
          <span>{sub}</span>
        </p>
      )}
    </Card>
  );
}

/** Layout-mirroring skeleton for StatCard. */
export function StatCardSkeleton() {
  return (
    <Card className="space-y-3 p-5" aria-hidden="true">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-14" />
      <Skeleton className="h-3 w-24" />
    </Card>
  );
}

export default StatCard;
