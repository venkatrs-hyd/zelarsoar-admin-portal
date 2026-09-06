/**
 * FleetModal — accessible dialog for the fleet pages (Tenants / Users & Roles /
 * Licensing). WCAG AA: role="dialog" + aria-modal, focus trap, ESC closes,
 * focus is restored to the opener, body scroll locked while open.
 *
 *   <FleetModal open={open} onClose={close} title="New Tenant"
 *     subline="Creates the company…" chip={<GqlChip kind="mutation">…</GqlChip>}>
 *     …form…
 *   </FleetModal>
 */
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])';

export function FleetModal({
  open,
  onClose,
  title,
  subline,
  chip,
  children,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subline?: string;
  /** typically a <GqlChip kind="mutation"/> */
  chip?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] => {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      );
    };

    // Move focus into the dialog (first field, else the close button).
    const focusTimer = window.setTimeout(() => {
      const list = focusables();
      const firstField = list.find((el) => el.tagName === 'INPUT' || el.tagName === 'SELECT');
      (firstField ?? list[0] ?? panelRef.current)?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      lastFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-[rgba(30,27,34,.45)]"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="card-surface pointer-events-auto my-8 w-full shadow-card-lg outline-none"
          style={{ maxWidth }}
        >
          <div className="flex items-start justify-between border-b border-line-soft px-6 pb-4 pt-5">
            <div>
              <h2 id={titleId} className="font-display text-[17px] font-semibold">
                {title}
              </h2>
              {subline && <p className="mt-0.5 text-[12.5px] text-ink-3">{subline}</p>}
            </div>
            <div className="flex items-center gap-2">
              {chip}
              <button
                type="button"
                aria-label="Close dialog"
                className="grid h-8 w-8 place-items-center rounded-[10px] text-ink-2 hover:bg-paper"
                onClick={onClose}
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default FleetModal;
