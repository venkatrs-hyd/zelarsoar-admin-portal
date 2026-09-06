import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import Card from './Card';

/**
 * EmptyState — calm icon + headline + subline, optional action.
 *   <EmptyState
 *     icon={ShieldCheck}
 *     title="Nothing needs you right now"
 *     message="When the first alert arrives it will appear here."
 *     action={<button className="btn btn-primary">Add your first tenant</button>}
 *   />
 */
export function EmptyState({
  icon: Icon = ShieldCheck,
  tone = 'calm',
  title,
  message,
  action,
  className,
}: {
  icon?: LucideIcon;
  /** calm = green tile (all good), neutral = paper tile */
  tone?: 'calm' | 'neutral';
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('mx-auto max-w-[560px] p-8 text-center sm:p-14', className)}>
      <span
        className={cn(
          'mx-auto grid h-12 w-12 place-items-center rounded-full',
          tone === 'calm' ? 'bg-calm-tint text-calm' : 'bg-[#F1EEE6] text-ink-3',
        )}
      >
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h2 className="font-display mt-4 text-[18px] font-semibold">{title}</h2>
      {message && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{message}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </Card>
  );
}

export default EmptyState;
