/**
 * State Gallery (route `/states`) — per design/states-ds.md + approved
 * states.html mockup. All seven GraphQL state patterns side by side, each with
 * a GqlChip naming the Apollo mechanism. Panels 3, 4, 6 and 7 are LIVE against
 * the embedded gateway: fault injection via `@/graphql/faults` and real
 * blockIp/unblockIp mutations.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { gql, useMutation, useQuery, NetworkStatus } from '@apollo/client';
import {
  Check,
  CheckCircle2,
  LoaderCircle,
  SearchCheck,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  PartialBanner,
  Skeleton,
  SpinnerButton,
  StatusPill,
  useToast,
} from '@/components';
import { cn } from '@/lib/utils';
import { faults } from '@/graphql/faults';
import type { Severity, ThreatIntelSummary } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations (operation names double as fault-injection keys)         */
/* ------------------------------------------------------------------ */
const STATES_ERROR_DEMO = gql`
  query StatesErrorDemo {
    dashboardKpis {
      tenants
      users
      roles
    }
  }
`;

const STATES_PARTIAL_DEMO = gql`
  query StatesPartialDemo {
    threatIntel {
      geoOrigins {
        country
        count
        severity
      }
      topTtp {
        id
        name
      }
    }
  }
`;

const STATES_OFFLINE_DEMO = gql`
  query StatesOfflineDemo {
    dashboardKpis {
      tenants
    }
  }
`;

const BLOCK_IP = gql`
  mutation StatesBlockIp($input: BlockIpInput!) {
    blockIp(input: $input) {
      blockedIp {
        id
        ip
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UNBLOCK_IP = gql`
  mutation StatesUnblockIp($ip: String!, $tenantId: ID!) {
    unblockIp(ip: $ip, tenantId: $tenantId) {
      unblockedIp
      userErrors {
        field
        message
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Shared page-local bits                                              */
/* ------------------------------------------------------------------ */
function PanelHeader({
  id,
  title,
  hint,
  chip,
}: {
  id: string;
  title: ReactNode;
  hint?: string;
  chip: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="font-display text-[16px] font-semibold">
        {title}{' '}
        {hint && <span className="text-[13px] font-normal text-ink-3">— {hint}</span>}
      </h2>
      {chip}
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[12px] text-ink-3">{children}</p>;
}

function FaultButtons({
  operation,
  fault,
  label,
  onChanged,
}: {
  operation: string;
  fault: 'server-error' | 'offline' | 'partial';
  label: string;
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          faults.set(operation, fault);
          onChanged();
        }}
      >
        {label}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          faults.clear();
          onChanged();
        }}
      >
        Clear fault + refetch
      </button>
      <span className="mono text-[10.5px] text-faint">
        faults.set('{operation}', '{fault}')
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 3 — error boundary (live)                                     */
/* ------------------------------------------------------------------ */
function ErrorBoundaryPanel() {
  const { data, error, loading, refetch } = useQuery<{
    dashboardKpis: { tenants: number; users: number; roles: number };
  }>(STATES_ERROR_DEMO);
  const traceId =
    (error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (error ? 'net-local' : undefined);

  return (
    <section aria-labelledby="g3">
      <PanelHeader
        id="g3"
        title="3 · Error boundary"
        hint="query failed, region contained"
        chip={<GqlChip kind="query">query StatesErrorDemo · error → boundary</GqlChip>}
      />
      <div className="space-y-3">
        <FaultButtons
          operation="StatesErrorDemo"
          fault="server-error"
          label="Inject server error"
          onChanged={() => void refetch()}
        />
        {error && !data ? (
          <ErrorCard
            title="This section didn’t load"
            message={
              <>
                The query <span className="mono text-[12px]">StatesErrorDemo</span> failed against
                the live gateway. Calm copy names the failed operation, reassures about data
                safety, and offers one clear action.
              </>
            }
            traceId={traceId}
            boundary="RegionBoundary"
            onRetry={() => {
              faults.clear();
              void refetch();
            }}
          />
        ) : (
          <Card className="p-5" aria-busy={loading}>
            {loading && !data ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-calm-tint text-calm">
                  <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="text-[13px] text-ink-2">
                  Gateway healthy —{' '}
                  <span className="font-semibold text-ink">
                    {data?.dashboardKpis.tenants} tenants · {data?.dashboardKpis.users} users ·{' '}
                    {data?.dashboardKpis.roles} roles
                  </span>{' '}
                  loaded. Inject a server error above to watch this region fail into the boundary
                  card, then recover.
                </p>
              </div>
            )}
            <Rule>
              Rule: boundaries wrap <em>regions</em>, never the whole app — one failed widget can’t
              take the page down. The trace ID makes support tickets painless.
            </Rule>
          </Card>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 4 — partial data (live, errorPolicy: 'all')                   */
/* ------------------------------------------------------------------ */
function PartialDataPanel() {
  const { data, error, refetch } = useQuery<{
    threatIntel: Pick<ThreatIntelSummary, 'geoOrigins'> & { topTtp: { id: string; name: string } };
  }>(STATES_PARTIAL_DEMO, { errorPolicy: 'all' });

  const geoOrigins = data?.threatIntel.geoOrigins ?? null;
  const partial = !!error || (data != null && geoOrigins == null);

  return (
    <section aria-labelledby="g4">
      <PanelHeader
        id="g4"
        title="4 · Partial data"
        hint="sub-field failed, data still renders"
        chip={<GqlChip kind="query">query StatesPartialDemo · errorPolicy: 'all'</GqlChip>}
      />
      <div className="space-y-3">
        <FaultButtons
          operation="StatesPartialDemo"
          fault="partial"
          label="Fail the geoOrigins field"
          onChanged={() => void refetch()}
        />
        <Card className="space-y-4 p-5">
          {partial && (
            <PartialBanner
              title="Locations unavailable."
              field="threatIntel.geoOrigins"
              message="Field threatIntel.geoOrigins failed — the rest of the payload rendered below."
              onRetry={() => {
                faults.clear();
                void refetch();
              }}
            />
          )}
          <div className="flex flex-wrap items-center gap-3 px-1">
            {geoOrigins ? (
              geoOrigins.slice(0, 4).map((g: { country: string; count: number; severity: Severity }) => (
                <StatusPill key={g.country} tone="neutral">
                  {g.country} · {g.count}
                </StatusPill>
              ))
            ) : (
              <StatusPill tone="neutral">
                <TriangleAlert size={11} strokeWidth={2} aria-hidden="true" />
                location data unavailable
              </StatusPill>
            )}
            {data?.threatIntel.topTtp && (
              <span className="text-[12px] text-ink-3">
                top TTP <span className="mono text-[11.5px]">{data.threatIntel.topTtp.id}</span>{' '}
                {data.threatIntel.topTtp.name} — this field resolved fine
              </span>
            )}
          </div>
          <Rule>
            Rule: partial failure degrades one column, not the page. The banner names the exact
            GraphQL field and offers a targeted retry.
          </Rule>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 6 — offline / reconnecting (live)                             */
/* ------------------------------------------------------------------ */
function OfflinePanel() {
  const { data, error, networkStatus, refetch } = useQuery<{
    dashboardKpis: { tenants: number };
  }>(STATES_OFFLINE_DEMO, { notifyOnNetworkStatusChange: true });

  const offline = !!error && !data;
  const reconnecting = !error && networkStatus === NetworkStatus.refetch;

  return (
    <section aria-labelledby="g6">
      <PanelHeader
        id="g6"
        title="6 · Offline & subscription reconnecting"
        chip={<GqlChip kind="subscription">faults.set('StatesOfflineDemo', 'offline')</GqlChip>}
      />
      <div className="space-y-3">
        <FaultButtons
          operation="StatesOfflineDemo"
          fault="offline"
          label="Go offline"
          onChanged={() => void refetch()}
        />
        {offline ? (
          <div
            className="flex items-start gap-[10px] rounded-card border border-[#CFDCE3] bg-sev-low-tint px-[14px] py-3 text-sev-low-ink"
            role="status"
          >
            <WifiOff size={15} strokeWidth={1.8} className="mt-[1px] shrink-0" aria-hidden="true" />
            <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[13px]">
                <span className="font-semibold">You’re offline.</span> The gateway rejected the
                query with a network error — actions will queue and send when you’re back.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm ml-auto"
                onClick={() => {
                  faults.clear();
                  void refetch();
                }}
              >
                Retry now
              </button>
            </div>
          </div>
        ) : reconnecting ? (
          <div
            className="flex items-start gap-[10px] rounded-card border border-[#EBD9BC] bg-sev-high-tint px-[14px] py-3 text-sev-high-ink"
            role="status"
          >
            <LoaderCircle
              size={15}
              className="mt-[1px] shrink-0 animate-spin-rot"
              aria-hidden="true"
            />
            <p className="text-[13px]">
              <span className="font-semibold">Reconnecting to live feed…</span> Nothing is lost —
              the gap back-fills on reconnect.
            </p>
          </div>
        ) : (
          <div
            className="flex items-start gap-[10px] rounded-card border border-line bg-white px-[14px] py-3 text-ink-2"
            role="status"
          >
            <CheckCircle2 size={15} className="mt-[1px] shrink-0 text-calm" aria-hidden="true" />
            <p className="text-[13px]">
              <span className="font-semibold text-ink">Connected.</span>{' '}
              {data ? `${data.dashboardKpis.tenants} tenants reporting.` : 'Checking…'} Press “Go
              offline” to watch a real query drop into the offline banner, then recover.
            </p>
          </div>
        )}
        <p className="text-[12px] text-ink-3">
          Rule: connection problems are a quiet banner, not a modal. The app stays readable and
          honest about freshness — subscriptions resume and back-fill on reconnect.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Panel 7 — optimistic mutation demo (live)                           */
/* ------------------------------------------------------------------ */
const DEMO_IP = '203.0.113.87'; // TEST-NET-3 — safe demo target
const DEMO_TENANT = 'T-001';

const STEPS = [
  { title: '1 · Idle', body: 'Button ready, one tap' },
  { title: '2 · Pending', body: 'Spinner in place, aria-busy' },
  { title: '3 · Confirmed', body: 'Calm green chip' },
  { title: '4 · Undo', body: 'Toast for 8s, aria-live' },
];

function OptimisticPanel() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [blockIp] = useMutation(BLOCK_IP);
  const [unblockIp] = useMutation(UNBLOCK_IP);

  const handleUnblock = async () => {
    try {
      await unblockIp({ variables: { ip: DEMO_IP, tenantId: DEMO_TENANT } });
      setStep(0);
      toast({ title: 'Block removed', description: `${DEMO_IP} is no longer blocked.` });
    } catch {
      toast({
        title: 'Undo failed',
        description: 'The unblockIp mutation did not reach the gateway.',
        tone: 'warning',
      });
    }
  };

  const handleBlock = async () => {
    setStep(1);
    try {
      const res = await blockIp({
        variables: {
          input: { ip: DEMO_IP, tenantId: DEMO_TENANT, reason: 'State Gallery optimistic demo' },
        },
        optimisticResponse: {
          blockIp: {
            __typename: 'BlockIpPayload',
            blockedIp: { __typename: 'BlockedIp', id: 'optimistic-demo', ip: DEMO_IP },
            userErrors: [],
          },
        },
      });
      const payload = res.data?.blockIp;
      const errs = payload?.userErrors ?? [];
      if (!payload?.blockedIp && errs.length > 0 && !errs[0].message.includes('already blocked')) {
        setStep(0);
        toast({ title: 'Block failed', description: errs[0].message, tone: 'warning' });
        return;
      }
      setStep(2);
      window.setTimeout(() => setStep(3), 1200);
      toast({
        title: `${DEMO_IP} blocked`,
        description: 'Optimistic update confirmed by mutation blockIp.',
        action: { label: 'Undo', onClick: () => void handleUnblock() },
        duration: 8000,
      });
    } catch {
      setStep(0);
      toast({
        title: 'Block failed',
        description: 'The mutation did not reach the gateway. The UI reverted — never silent.',
        tone: 'warning',
      });
    }
  };

  return (
    <section aria-labelledby="g7">
      <PanelHeader
        id="g7"
        title="7 · Optimistic mutation"
        hint="try it, it’s interactive"
        chip={<GqlChip kind="mutation">mutation blockIp · optimisticResponse</GqlChip>}
      />
      <Card className="max-w-[640px] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="mono text-[12.5px]">{DEMO_IP}</span>
          <StatusPill tone="critical">Threat confirmed · 94</StatusPill>
          <span className="flex-1" />
          {step >= 3 || step === 2 ? (
            <StatusPill tone="calm">
              <Check size={11} strokeWidth={2.4} aria-hidden="true" />
              Blocked
            </StatusPill>
          ) : (
            <SpinnerButton
              size="sm"
              loading={step === 1}
              spinnerLabel="Blocking…"
              onClick={() => void handleBlock()}
              aria-label={`Block ${DEMO_IP}`}
            >
              Block
            </SpinnerButton>
          )}
        </div>
        <ol className="mt-5 grid gap-2 text-[11.5px] text-ink-3 sm:grid-cols-4" aria-label="Mutation lifecycle">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              data-step={i}
              aria-current={step === i ? 'step' : undefined}
              className={cn(
                'rounded-[10px] border px-3 py-2 transition-colors',
                step === i ? 'border-brand-strong bg-brand-tint' : 'border-line',
              )}
            >
              <span className="block text-[12px] font-semibold text-ink">{s.title}</span>
              {s.body}
            </li>
          ))}
        </ol>
        <Rule>
          Rule: the UI commits immediately, labels the wait honestly, and always offers a way back.
          Failure reverts with an error toast — never silent.
        </Rule>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function States() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="max-w-[760px] text-[15px] text-ink-2">
          <span className="font-semibold text-ink">Every GraphQL state, on one page.</span>{' '}
          <span className="text-ink-3">
            Each screen in this portal implements these patterns. Panels 3, 4, 6 and 7 run against
            the live embedded gateway — inject a fault and watch a real query fail and recover.
          </span>
        </p>
      </div>

      {/* 1 · full-page loading */}
      <section aria-labelledby="g1">
        <PanelHeader
          id="g1"
          title="1 · Full-page loading"
          hint="first fetch, nothing cached"
          chip={<GqlChip kind="query">query alerts · networkStatus: loading</GqlChip>}
        />
        <Card className="p-5" aria-busy="true">
          <p className="sr-only" role="status">
            Example of a page loading
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10 w-4/5" />
          </div>
          <Rule>
            Rule: skeletons mirror the final layout 1:1 — no spinners, no “Loading…” text, no
            layout jump when data arrives. Screen readers get one polite{' '}
            <span className="mono text-[11px]">role="status"</span> announcement.
          </Rule>
        </Card>
      </section>

      {/* 2 · nested skeletons */}
      <section aria-labelledby="g2">
        <PanelHeader
          id="g2"
          title="2 · Nested skeletons"
          hint="list refetching inside a loaded page"
          chip={<GqlChip kind="query">fetchMore(after: $cursor) · notifyOnNetworkStatusChange</GqlChip>}
        />
        <Card className="p-5">
          <div className="flex items-center gap-3 border-b border-line-soft pb-3">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-calm-tint text-calm">
              <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-medium">
                SOAR auto-blocked <span className="mono text-[12px]">45.148.10.22</span>
              </p>
              <p className="text-[12px] text-ink-3">already-loaded row stays interactive</p>
            </div>
          </div>
          <div className="space-y-3 pt-3" aria-busy="true">
            <p className="sr-only" role="status">
              Loading the next rows
            </p>
            {(['w-1/2 w-1/3 w-16', 'w-2/5 w-1/4 w-20'] as const).map((widths, i) => {
              const [a, b, c] = widths.split(' ');
              return (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 !rounded-[9px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className={cn('h-3', a)} />
                    <Skeleton className={cn('h-3', b)} />
                  </div>
                  <Skeleton className={cn('h-5 !rounded-full', c)} />
                </div>
              );
            })}
          </div>
          <Rule>
            Rule: refetches never blank the region. Existing rows stay; skeleton rows append where
            new data will land.
          </Rule>
        </Card>
      </section>

      {/* 3 · error boundary (live) */}
      <ErrorBoundaryPanel />

      {/* 4 · partial data (live) */}
      <PartialDataPanel />

      {/* 5 · empty states */}
      <section aria-labelledby="g5">
        <PanelHeader
          id="g5"
          title="5 · Empty states"
          hint="zero results is good news, say so"
          chip={<GqlChip kind="query">query incidents · edges: []</GqlChip>}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={ShieldCheck}
            tone="calm"
            title="Nothing needs you right now"
            message="No open incidents across your 8 tenants. The engine is watching — if something needs a human, it shows up here."
            className="!max-w-none !p-8"
          />
          <EmptyState
            icon={SearchCheck}
            tone="neutral"
            title="No alerts match these filters"
            message="Nothing critical in Cokpit Division this week. Try widening the date range."
            className="!max-w-none !p-8"
            action={
              <button type="button" className="btn btn-secondary btn-sm">
                Clear all filters
              </button>
            }
          />
        </div>
        <p className="mt-3 text-[12px] text-ink-3">
          Rule: empty = plain sentence + one suggested next step. Green shield for “all clear”,
          blue for “adjust your search”.
        </p>
      </section>

      {/* 6 · offline / reconnecting (live) */}
      <OfflinePanel />

      {/* 7 · optimistic mutation (live) */}
      <OptimisticPanel />

      <footer className="pb-2 pt-2 text-center">
        <p className="text-[12px] text-ink-3">
          These seven patterns cover every loading, error, empty and live condition in the portal.
        </p>
      </footer>
    </>
  );
}
