/**
 * Fault injection for the State Gallery and ?state= demos (design.md §4).
 * Faults are keyed by GraphQL operationName, e.g.:
 *
 *   import { faults } from '@/graphql/faults';
 *   faults.set('ThreatIntel', 'partial');       // sub-field error, page keeps rendering
 *   faults.set('DashboardKpis', 'server-error'); // ErrorCard state
 *   faults.set('Alerts', 'offline');            // network-style failure
 *   faults.clear();                              // back to ready
 *
 * Also reachable from the console as window.__ZELAR_FAULTS__.
 */
export type FaultKind = 'none' | 'offline' | 'server-error' | 'partial';

const store = new Map<string, FaultKind>();
const subscribers = new Set<() => void>();

export const faults = {
  get(operationName: string): FaultKind {
    return store.get(operationName) ?? 'none';
  },
  set(operationName: string, kind: FaultKind): void {
    if (kind === 'none') store.delete(operationName);
    else store.set(operationName, kind);
    subscribers.forEach((fn) => fn());
  },
  clear(): void {
    store.clear();
    subscribers.forEach((fn) => fn());
  },
  list(): Record<string, FaultKind> {
    return Object.fromEntries(store);
  },
  /** React-friendly change subscription (useSyncExternalStore). */
  subscribe(fn: () => void): () => void {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },
};

declare global {
  interface Window {
    __ZELAR_FAULTS__?: typeof faults;
  }
}

if (typeof window !== 'undefined') {
  window.__ZELAR_FAULTS__ = faults;
}
