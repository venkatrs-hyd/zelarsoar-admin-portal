/**
 * Tiny typed event emitter backing GraphQL subscriptions (design.md §4).
 * Timers start lazily on first subscription and emit:
 *   telemetryTick   every ~3s  (epm series, ends near 74 ev/min)
 *   alertCreated    every ~9s  (plausible alert, prepended to the store)
 *   incidentUpdated every ~45s (status heartbeat on an open incident)
 */
import { alerts, auditEvents, generateLiveAlert, incidents, telemetrySeed } from './data';
import type { Alert, Incident, Telemetry } from './types';

type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

function emit(event: string, payload: unknown): void {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

function on(event: string, fn: Handler): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

/** AsyncIterable suitable for a GraphQL subscribe resolver. */
export function liveStream<T>(event: string, seed?: T): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const queue: T[] = seed !== undefined ? [seed] : [];
      let notify: (() => void) | null = null;
      let done = false;
      const off = on(event, (payload) => {
        queue.push(payload as T);
        notify?.();
        notify = null;
      });
      return {
        next(): Promise<IteratorResult<T>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift() as T, done: false });
          }
          if (done) return Promise.resolve({ value: undefined as never, done: true });
          return new Promise<IteratorResult<T>>((resolve) => {
            notify = () => {
              if (queue.length > 0) resolve({ value: queue.shift() as T, done: false });
              else resolve({ value: undefined as never, done: true });
            };
          });
        },
        return(): Promise<IteratorResult<T>> {
          done = true;
          off();
          notify?.();
          return Promise.resolve({ value: undefined as never, done: true });
        },
      };
    },
  };
}

let started = false;

/** Idempotent: starts the fake live feed timers. */
export function startLiveFeed(): void {
  if (started) return;
  started = true;

  const series = [...telemetrySeed.series];
  let epm = telemetrySeed.eventsPerMinute;

  setInterval(() => {
    epm = Math.max(28, Math.min(96, epm + Math.round((Math.random() - 0.48) * 10)));
    series.push(epm);
    if (series.length > 24) series.shift();
    const tick: Telemetry = { timestamp: new Date().toISOString(), eventsPerMinute: epm, series: [...series] };
    emit('telemetryTick', tick);
  }, 3000);

  setInterval(() => {
    const alert: Alert = generateLiveAlert();
    auditEvents.unshift({
      id: `AU-L${Date.now()}`,
      timestamp: alert.timestamp,
      actor: 'SOAR Engine',
      kind: 'THREAT',
      action: alert.verdict === 'THREAT_CONFIRMED' ? 'Threat confirmed' : 'Alert received',
      detail: `${alert.description} · from ${alert.sourceIp}`,
      tenant: alert.tenant,
      severity: alert.severity,
    });
    emit('alertCreated', alert);
  }, 9000);

  setInterval(() => {
    const open = incidents.find((i) => i.status === 'OPEN') ?? incidents[0];
    if (!open || !alerts.length) return;
    const updated: Incident = { ...open, updatedAt: new Date().toISOString() };
    emit('incidentUpdated', updated);
  }, 45000);
}
