import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type GqlKind = 'query' | 'mutation' | 'subscription';

const dotClass: Record<GqlKind, string> = {
  query: 'bg-brand',
  mutation: 'bg-sev-high',
  subscription: 'bg-calm',
};

/**
 * GqlChip — mono annotation chip naming the operation behind a region.
 *   <GqlChip kind="query">query alerts(first: 25, after: $cursor)</GqlChip>
 * Color-coded dot: blue=query, amber=mutation, green=subscription.
 */
export function GqlChip({ kind = 'query', children, className }: { kind?: GqlKind; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'mono inline-flex max-w-full min-w-0 shrink items-center gap-[5px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[#E2DCCB] bg-[#F1EEE5] px-[7px] py-[2px] text-[10.5px] font-medium text-[#5E594C]',
        className,
      )}
    >
      <span className={cn('h-[6px] w-[6px] flex-none rounded-[2px]', dotClass[kind])} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export default GqlChip;
