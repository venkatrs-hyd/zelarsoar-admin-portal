/**
 * Toast system — aria-live toasts incl. the Undo pattern (design.md §5).
 *
 *   // once, near the root (already wired in AppLayout):
 *   <ToastProvider><App/></ToastProvider>   // + <ToastViewport/> in the layout
 *
 *   // anywhere:
 *   const { toast } = useToast();
 *   toast({ title: '45.148.10.22 unblocked', description: 'The rule was removed.',
 *           action: { label: 'Undo', onClick: reblock } });
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'default' | 'success' | 'warning';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Undo / action button */
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss (default 6000, 0 = sticky) */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions): number => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...options, id }]);
      const duration = options.duration ?? 6000;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const toneIcon: Record<ToastTone, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
};

/** Rendered by ToastProvider; exported for completeness (usually not used directly). */
export function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="fixed bottom-4 left-4 z-[60] w-[min(92vw,400px)] space-y-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = toneIcon[t.tone ?? 'default'];
        return (
          <div
            key={t.id}
            className="animate-toast-rise flex items-start gap-[10px] rounded-card bg-forest px-[14px] py-3 text-[#F4F1E9] shadow-card-lg"
            role="status"
          >
            <Icon
              size={16}
              strokeWidth={1.8}
              className={cn('mt-[1px] shrink-0', t.tone === 'warning' ? 'text-sev-high' : 'text-brand-accent')}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12px] text-[#F4F1E9]/70">{t.description}</p>}
              {t.action && (
                <button
                  type="button"
                  className="mt-1.5 text-[12.5px] font-semibold text-brand-accent underline-offset-2 hover:underline"
                  onClick={() => {
                    t.action?.onClick();
                    onDismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-[#F4F1E9]/60 hover:bg-forest-2 hover:text-[#F4F1E9]"
              onClick={() => onDismiss(t.id)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
