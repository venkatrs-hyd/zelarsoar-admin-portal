import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card — white 12px-radius surface with the brand card shadow.
 *   <Card className="p-5">…</Card>
 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-surface', className)} {...rest} />;
}

export default Card;
