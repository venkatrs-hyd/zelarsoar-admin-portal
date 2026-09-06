import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SpinnerButton — button with inline spinner state for mutations.
 *   <SpinnerButton variant="primary" loading={saving} onClick={save}>Save policy</SpinnerButton>
 */
export function SpinnerButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  spinnerLabel = 'Working…',
  children,
  disabled,
  className,
  ...rest
}: {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  loading?: boolean;
  /** accessible label announced while loading */
  spinnerLabel?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <LoaderCircle size={14} className="animate-spin-rot flex-none" aria-hidden="true" />
      )}
      <span>{loading ? spinnerLabel : children}</span>
    </button>
  );
}

export default SpinnerButton;
