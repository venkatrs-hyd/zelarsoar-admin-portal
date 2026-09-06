import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton — shimmering placeholder block (mirrors final layout).
 * Shimmer is disabled under prefers-reduced-motion (global CSS).
 *   <Skeleton className="h-4 w-32" />
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skel', className)} aria-hidden="true" {...rest} />;
}

export default Skeleton;
