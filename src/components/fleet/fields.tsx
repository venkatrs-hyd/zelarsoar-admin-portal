/**
 * Shared form primitives for the fleet pages (design mockup .input/.field-err
 * grammar). Presentational only — no state.
 */
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Matches the mockup .input (38px, 10px radius, --line border). */
export const inputClass =
  'h-[38px] w-full rounded-[10px] border border-line bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-3';

export const inputErrorClass = 'border-sev-critical';

export const labelClass = 'mb-1.5 block text-[12.5px] font-medium';

/**
 * FieldError — inline GraphQL userErrors mapped under a field
 * (`userErrors[i] · field: ["input","name"]` — message).
 */
export function FieldError({
  id,
  index,
  field,
  message,
}: {
  id: string;
  index: number;
  field: string;
  message: ReactNode;
}) {
  return (
    <p id={id} role="alert" className={cn('mt-1.5 flex items-start gap-1.5 text-[12px] text-sev-critical-ink')}>
      <CircleAlert size={13} strokeWidth={2} className="mt-[1px] shrink-0" aria-hidden="true" />
      <span>
        <span className="mono text-[11px]">
          userErrors[{index}] · field: [&quot;input&quot;,&quot;{field}&quot;]
        </span>{' '}
        — {message}
      </span>
    </p>
  );
}
