/**
 * GatewayLink — a custom Apollo Link that executes every operation against the
 * embedded executable schema (design.md §4). Repointing to a real gateway later
 * is a one-Link change.
 *
 * - Simulated network latency: 250–700ms per operation.
 * - Subscriptions stream from the local event emitter (live.ts).
 * - Fault injection per operationName via faults.ts:
 *     faults.set('Alerts', 'server-error')  → GraphQL errors, no data
 *     faults.set('Alerts', 'offline')       → network error
 *     faults.set('ThreatIntel', 'partial')  → data + field-level errors
 */
import { ApolloLink, Observable } from '@apollo/client';
import type { FetchResult, Operation } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLError, execute, subscribe } from 'graphql';
import type { ExecutionResult } from 'graphql';
import { faults } from './faults';
import { startLiveFeed } from './live';
import { schema } from './schema';

function latency(): number {
  return 250 + Math.random() * 450;
}

function isSubscription(operation: Operation): boolean {
  const def = getMainDefinition(operation.query);
  return def.kind === 'OperationDefinition' && def.operation === 'subscription';
}

function serverErrorResult(operationName: string): FetchResult {
  return {
    errors: [
      new GraphQLError(`GATEWAY_ERROR: simulated server error for ${operationName}`, {
        extensions: { code: 'GATEWAY_500', traceId: Math.random().toString(16).slice(2, 8) },
      }),
    ],
  };
}

export class GatewayLink extends ApolloLink {
  request(operation: Operation): Observable<FetchResult> {
    return new Observable<FetchResult>((observer) => {
      let cancelled = false;
      let iterator: AsyncIterator<ExecutionResult> | null = null;

      const fault = faults.get(operation.operationName);
      const contextValue = { forcePartial: fault === 'partial' };
      const delay = isSubscription(operation) ? 150 : latency();

      const timer = setTimeout(() => {
        if (cancelled) return;

        if (fault === 'offline') {
          observer.error(
            new Error(`NETWORK_OFFLINE: simulated offline fault for ${operation.operationName}`),
          );
          return;
        }
        if (fault === 'server-error') {
          observer.next(serverErrorResult(operation.operationName));
          observer.complete();
          return;
        }

        if (isSubscription(operation)) {
          startLiveFeed();
          void (async () => {
            try {
              const result = await subscribe({
                schema,
                document: operation.query,
                variableValues: operation.variables,
                operationName: operation.operationName,
                contextValue,
              });
              if (Symbol.asyncIterator in Object(result)) {
                iterator = result as AsyncIterator<ExecutionResult>;
                while (!cancelled) {
                  const next = await iterator.next();
                  if (next.done || cancelled) break;
                  observer.next(next.value as FetchResult);
                }
                if (!cancelled) observer.complete();
              } else {
                observer.next(result as FetchResult);
                observer.complete();
              }
            } catch (err) {
              if (!cancelled) observer.error(err);
            }
          })();
          return;
        }

        void (async () => {
          try {
            const result = await execute({
              schema,
              document: operation.query,
              variableValues: operation.variables,
              operationName: operation.operationName,
              contextValue,
            });
            if (!cancelled) {
              observer.next(result as FetchResult);
              observer.complete();
            }
          } catch (err) {
            if (!cancelled) observer.error(err);
          }
        })();
      }, delay);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        void iterator?.return?.();
      };
    });
  }
}
