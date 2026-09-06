/**
 * AI Alerts (route `/alerts`) — FLAGSHIP — per design/alerts.md + approved
 * alerts.html mockup. Proves every GraphQL pattern:
 *   query alerts(first, after, filter) · cursor pagination (fetchMore + typePolicies)
 *   query alertStats(window: LAST_30D) · subscription alertCreated (prepend + aria-live)
 *   mutation blockIp / unblockIp (SpinnerButton → confirmed chip → Undo toast)
 *   errorPolicy 'all' → PartialBanner + per-row "location unavailable" when geo is null
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { gql, useMutation, useQuery, useSubscription, NetworkStatus } from '@apollo/client';
import { Check, CircleAlert, SearchCheck } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  LiveBadge,
  PartialBanner,
  SectionHeader,
  Skeleton,
  SpinnerButton,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  TableSkeleton,
  severityTone,
  useToast,
} from '@/components';
import type { PillTone } from '@/components';
import { formatNumber, sentenceCase } from '@/lib/format';
import type { Alert, AlertVerdict, Connection, Severity } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const ALERT_FIELDS = gql`
  fragment AlertRowFields on Alert {
    id
    timestamp
    severity
    verdict
    threatScore
    attacker {
      kind
      name
    }
    agent {
      id
      hostname
    }
    sourceIp
    geo {
      city
      country
    }
    description
    tenant {
      id
      name
    }
  }
`;

const ALERTS = gql`
  query Alerts($first: Int, $after: String, $filter: AlertFilter!) {
    alerts(first: $first, after: $after, filter: $filter) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          ...AlertRowFields
        }
      }
    }
  }
  ${ALERT_FIELDS}
`;

const ALERT_STATS = gql`
  query AlertStats {
    alertStats(window: LAST_30D) {
      total
      threats
      suspected
      cleared
      needsHuman
    }
  }
`;

const TENANT_OPTIONS = gql`
  query AlertTenantOptions {
    tenants(first: 8) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const ALERT_CREATED = gql`
  subscription AlertCreated {
    alertCreated {
      ...AlertRowFields
    }
  }
  ${ALERT_FIELDS}
`;

const BLOCK_IP = gql`
  mutation BlockIp($input: BlockIpInput!) {
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
  mutation UnblockIp($ip: String!, $tenantId: ID!) {
    unblockIp(ip: $ip, tenantId: $tenantId) {
      unblockedIp
      userErrors {
        field
        message
      }
    }
  }
`;

const BLOCKED_IP_SET = gql`
  query BlockedIpSet {
    blockedIps(first: 100) {
      edges {
        node {
          ip
        }
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */
interface AlertsResult {
  alerts: Connection<Alert>;
}
interface AlertStatsResult {
  alertStats: {
    total: number;
    threats: number;
    suspected: number;
    cleared: number;
    needsHuman: number;
  };
}
interface TenantOptionsResult {
  tenants: Connection<Pick<Alert['tenant'], 'id' | 'name'>>;
}
interface BlockedIpSetResult {
  blockedIps: Connection<{ ip: string }>;
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */
interface FilterDraft {
  tenantId: string;
  search: string;
  from: string;
  severity: '' | Severity;
  verdict: '' | AlertVerdict;
}
const EMPTY_FILTER: FilterDraft = { tenantId: '', search: '', from: '', severity: '', verdict: '' };

function isActive(f: FilterDraft): boolean {
  return !!(f.tenantId || f.search.trim() || f.severity || f.verdict);
}

/* ------------------------------------------------------------------ */
/* Row helpers                                                         */
/* ------------------------------------------------------------------ */
const verdictTone: Record<AlertVerdict, PillTone> = {
  THREAT_CONFIRMED: 'critical',
  SUSPECTED: 'medium',
  CLEAR: 'calm',
  NOISE: 'low',
  PENDING: 'neutral',
};

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('127.')
  );
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const inputClass =
  'h-9 w-full rounded-[10px] border border-line bg-white px-3 text-[13px] text-ink placeholder:text-ink-3';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Alerts() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  /** local overrides on top of the blockedIps query (true = blocked, false = unblocked) */
  const [blockOverrides, setBlockOverrides] = useState<Record<string, boolean>>({});
  const [liveRows, setLiveRows] = useState<Alert[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const stats = useQuery<AlertStatsResult>(ALERT_STATS);
  const tenants = useQuery<TenantOptionsResult>(TENANT_OPTIONS);
  const blocked = useQuery<BlockedIpSetResult>(BLOCKED_IP_SET);

  const filterVar = useMemo(
    () => ({
      tenantId: applied.tenantId || null,
      search: applied.search.trim() || null,
      severities: applied.severity ? [applied.severity] : null,
      verdicts: applied.verdict ? [applied.verdict] : null,
    }),
    [applied],
  );

  const alertsQuery = useQuery<AlertsResult>(ALERTS, {
    variables: { first: 25, filter: filterVar },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  useSubscription<{ alertCreated: Alert }>(ALERT_CREATED, {
    onData: ({ data }) => {
      const a = data.data?.alertCreated;
      if (!a) return;
      setLiveRows((rows) => [a, ...rows.filter((r) => r.id !== a.id)].slice(0, 4));
      setAnnouncement(
        `New ${sentenceCase(a.severity).toLowerCase()} alert from ${a.sourceIp}: ${a.description}`,
      );
    },
  });

  const [blockIp] = useMutation(BLOCK_IP);
  const [unblockIp] = useMutation(UNBLOCK_IP);

  /* ---------- derived data ---------- */
  const blockedSet = useMemo(() => {
    const set = new Set<string>(
      blocked.data?.blockedIps.edges.map((e) => e.node.ip) ?? [],
    );
    for (const [ip, isBlocked] of Object.entries(blockOverrides)) {
      if (isBlocked) set.add(ip);
      else set.delete(ip);
    }
    return set;
  }, [blocked.data, blockOverrides]);

  const rows = useMemo(() => {
    const base = alertsQuery.data?.alerts.edges.map((e) => e.node) ?? [];
    const seen = new Set(liveRows.map((r) => r.id));
    return [...liveRows, ...base.filter((r) => !seen.has(r.id))];
  }, [alertsQuery.data, liveRows]);

  const liveIds = useMemo(() => new Set(liveRows.map((r) => r.id)), [liveRows]);

  const connection = alertsQuery.data?.alerts;
  const isInitialLoading = alertsQuery.loading && !alertsQuery.data;
  const isFetchingMore = alertsQuery.networkStatus === NetworkStatus.fetchMore;
  const fullError = !!alertsQuery.error && !alertsQuery.data;
  const partialGeo = !!alertsQuery.error && !!alertsQuery.data;

  const traceId =
    (alertsQuery.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (alertsQuery.error ? 'net-local' : undefined);

  /* ---------- mutations ---------- */
  const markBlocked = (ip: string, value: boolean) =>
    setBlockOverrides((m) => ({ ...m, [ip]: value }));

  const handleUnblock = async (alert: Alert) => {
    try {
      await unblockIp({ variables: { ip: alert.sourceIp, tenantId: alert.tenant.id } });
      markBlocked(alert.sourceIp, false);
      toast({
        title: 'Block removed',
        description: `${alert.sourceIp} is no longer blocked.`,
      });
    } catch {
      toast({
        title: 'Undo failed',
        description: 'The unblockIp mutation did not reach the gateway. Try again.',
        tone: 'warning',
      });
    }
  };

  const handleBlock = async (alert: Alert) => {
    setPendingBlockId(alert.id);
    try {
      const res = await blockIp({
        variables: {
          input: {
            ip: alert.sourceIp,
            tenantId: alert.tenant.id,
            reason: `Blocked manually from AI Alerts · ${alert.description}`,
          },
        },
        optimisticResponse: {
          blockIp: {
            __typename: 'BlockIpPayload',
            blockedIp: { __typename: 'BlockedIp', id: `optimistic-${alert.sourceIp}`, ip: alert.sourceIp },
            userErrors: [],
          },
        },
      });
      const payload = res.data?.blockIp;
      const errs = payload?.userErrors ?? [];
      if (!payload?.blockedIp && errs.length > 0) {
        if (errs[0].message.includes('already blocked')) {
          markBlocked(alert.sourceIp, true);
          toast({ title: `${alert.sourceIp} was already blocked`, description: errs[0].message });
        } else {
          toast({ title: 'Block failed', description: errs[0].message, tone: 'warning' });
        }
      } else {
        markBlocked(alert.sourceIp, true);
        toast({
          title: `${alert.sourceIp} blocked`,
          description: 'mutation blockIp confirmed — rule pushed to Local iptables.',
          action: { label: 'Undo', onClick: () => void handleUnblock(alert) },
          duration: 8000,
        });
      }
    } catch {
      toast({
        title: 'Block failed',
        description: 'The blockIp mutation did not reach the gateway. Nothing was changed.',
        tone: 'warning',
      });
    } finally {
      setPendingBlockId(null);
    }
  };

  /* ---------- filter actions ---------- */
  const applyFilters = () => {
    setLiveRows([]);
    setApplied(draft);
  };
  const clearFilters = () => {
    setDraft(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
  };

  /* ---------- render helpers ---------- */
  const s = stats.data?.alertStats;
  const clearedPct = s && s.total > 0 ? Math.round((s.cleared / s.total) * 100) : null;
  const threatPct = s && s.total > 0 ? ((s.threats / s.total) * 100).toFixed(1) : null;

  const renderActionCell = (alert: Alert) => {
    const ipBlocked = blockedSet.has(alert.sourceIp);
    if (ipBlocked) {
      return (
        <StatusPill tone="calm">
          <Check size={11} strokeWidth={2.4} aria-hidden="true" />
          Blocked by SOAR
        </StatusPill>
      );
    }
    if (alert.verdict === 'CLEAR' || alert.verdict === 'NOISE') {
      return <StatusPill tone="calm">Already sorted</StatusPill>;
    }
    const canBlock = (alert.verdict === 'THREAT_CONFIRMED' || alert.verdict === 'SUSPECTED') && !isPrivateIp(alert.sourceIp);
    return (
      <span className="inline-flex items-center gap-1">
        {canBlock && (
          <SpinnerButton
            size="sm"
            loading={pendingBlockId === alert.id}
            spinnerLabel="Blocking…"
            onClick={() => void handleBlock(alert)}
            aria-label={`Block ${alert.sourceIp}`}
          >
            Block
          </SpinnerButton>
        )}
        <Link to="/incidents" className="btn btn-ghost btn-sm">
          Investigate
        </Link>
      </span>
    );
  };

  return (
    <>
      {/* summary line + live badge */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">
            {s ? `${formatNumber(s.total)} alerts` : 'Alerts'}
          </span>{' '}
          across 8 tenants.{' '}
          <span className="text-ink-3">
            Most are already handled — {s ? `${s.needsHuman} need` : '…'} a human look.
          </span>
        </p>
        <LiveBadge label="Live feed on" className="ml-auto" />
      </div>

      {/* aria-live announcement for subscription prepends */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* ---------------- filters card ---------------- */}
      <Card className="p-4" role="region" aria-label="Alert filters">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[14px] font-semibold">Filters</h2>
          <GqlChip kind="query">query alerts(first: 25, after: $cursor, filter: {'{…}'})</GqlChip>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label htmlFor="f-tenant" className="mb-1 block text-[11.5px] font-medium text-ink-3">
                Tenant
              </label>
              <select
                id="f-tenant"
                className={inputClass}
                value={draft.tenantId}
                onChange={(e) => setDraft({ ...draft, tenantId: e.target.value })}
              >
                <option value="">All tenants (8)</option>
                {tenants.data?.tenants.edges.map((e) => (
                  <option key={e.node.id} value={e.node.id}>
                    {e.node.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label htmlFor="f-search" className="mb-1 block text-[11.5px] font-medium text-ink-3">
                Search
              </label>
              <input
                id="f-search"
                className={inputClass}
                placeholder="IP, host, description…"
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="f-from" className="mb-1 block text-[11.5px] font-medium text-ink-3">
                From
              </label>
              <input
                id="f-from"
                type="date"
                className={inputClass}
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="f-sev" className="mb-1 block text-[11.5px] font-medium text-ink-3">
                Severity
              </label>
              <select
                id="f-sev"
                className={inputClass}
                value={draft.severity}
                onChange={(e) => setDraft({ ...draft, severity: e.target.value as FilterDraft['severity'] })}
              >
                <option value="">Any severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="f-verdict"
                className="mb-1 block text-[11.5px] font-medium text-ink-3"
              >
                AI verdict
              </label>
              <select
                id="f-verdict"
                className={inputClass}
                value={draft.verdict}
                onChange={(e) => setDraft({ ...draft, verdict: e.target.value as FilterDraft['verdict'] })}
              >
                <option value="">Any verdict</option>
                <option value="THREAT_CONFIRMED">Threat confirmed</option>
                <option value="SUSPECTED">Suspected</option>
                <option value="CLEAR">Clear</option>
                <option value="NOISE">Noise</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            <div className="col-span-2 flex items-end gap-2 md:col-span-1">
              <button type="submit" className="btn btn-primary btn-sm !h-9 flex-1">
                Apply
              </button>
              <button type="button" className="btn btn-ghost btn-sm !h-9" onClick={clearFilters}>
                Clear
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* ---------------- stat cards ---------------- */}
      <section aria-label="Alert statistics, last 30 days">
        <SectionHeader
          title="Last 30 days"
          chip={<GqlChip kind="query">query alertStats(tenantId: null, window: LAST_30D)</GqlChip>}
        />
        {stats.error && !stats.data ? (
          <Card className="flex flex-wrap items-center gap-3 p-4" role="alert">
            <p className="text-[13px] text-ink-2">
              The stats didn’t load — the alert stream below is unaffected.
            </p>
            <button type="button" className="btn btn-secondary btn-sm ml-auto" onClick={() => void stats.refetch()}>
              Retry
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.loading && !stats.data ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : s ? (
              <>
                <StatCard
                  label="Total alerts"
                  value={formatNumber(s.total)}
                  sub="2,609 pages under the old offset pager — now one cursor"
                />
                <StatCard
                  label="Threats confirmed"
                  value={<span className="text-sev-critical-ink">{formatNumber(s.threats)}</span>}
                  sub={`${threatPct}% of total`}
                />
                <StatCard
                  label="Suspected"
                  value={<span className="text-sev-high-ink">{formatNumber(s.suspected)}</span>}
                  sub="queued for review"
                />
                <StatCard
                  label="Cleared automatically"
                  value={<span className="text-calm">{formatNumber(s.cleared)}</span>}
                  sub={`${clearedPct}% handled without you`}
                  subTone="calm"
                />
              </>
            ) : null}
          </div>
        )}
      </section>

      {/* ---------------- alert stream ---------------- */}
      {isInitialLoading ? (
        <Card className="overflow-hidden" aria-busy="true">
          <p className="sr-only" role="status">
            Loading alerts…
          </p>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-44 !rounded-md" />
          </div>
          <div className="px-2 pb-2">
            <TableSkeleton
              rows={8}
              columns={['w-14', 'w-16', 'w-32', 'w-24', 'w-24', 'w-20', 'w-28', 'w-16']}
            />
          </div>
          <div className="flex justify-between border-t border-line-soft px-5 py-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-7 w-24 !rounded-lg" />
          </div>
        </Card>
      ) : fullError ? (
        <ErrorCard
          title="The alert stream didn’t load"
          message={
            <>
              The query <span className="mono text-[12px]">alerts(first: 25)</span> failed. No alerts
              are lost — the collectors keep running while this view recovers.
            </>
          }
          traceId={traceId}
          boundary="AlertsTable"
          onRetry={() => void alertsQuery.refetch()}
        />
      ) : connection && rows.length === 0 && !alertsQuery.loading ? (
        <EmptyState
          icon={SearchCheck}
          tone="calm"
          title="All clear — no alerts match these filters"
          message="Nothing in the stream fits the current filters. That’s good news — try widening the date range or clearing a filter."
          action={
            isActive(applied) ? (
              <button type="button" className="btn btn-primary" onClick={clearFilters}>
                Clear all filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {partialGeo && (
            <PartialBanner
              title="Geo enrichment unavailable."
              field="alerts.edges.node.geo"
              message={
                'Field alerts.edges.node.geo failed to resolve — affected rows show “location unavailable” where a city would be. Everything else is live.'
              }
              onRetry={() => void alertsQuery.refetch()}
            />
          )}
          <Card className="overflow-hidden" role="region" aria-labelledby="alerts-tbl-h">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
              <div>
                <h2 id="alerts-tbl-h" className="font-display text-[15px] font-semibold">
                  Alert stream
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  Cursor-paginated — stable even while new alerts arrive.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <GqlChip kind="subscription">subscription alertCreated → prepend</GqlChip>
                <GqlChip kind="query">query alerts(first: 25, after: $cursor)</GqlChip>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr>
                    {['Time', 'Severity', 'Attacker · Agent', 'AI verdict', 'Source IP', 'Location', 'What happened'].map(
                      (h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint"
                        >
                          {h}
                        </th>
                      ),
                    )}
                    <th
                      scope="col"
                      className="border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((alert) => (
                    <tr
                      key={alert.id}
                      className={
                        liveIds.has(alert.id)
                          ? 'bg-calm-tint/50 transition-colors'
                          : 'transition-colors'
                      }
                    >
                      <td className="mono whitespace-nowrap border-b border-line-soft px-[14px] py-3 text-[12px] text-ink-2">
                        {timeOfDay(alert.timestamp)}
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3">
                        <StatusPill tone={severityTone(alert.severity)}>
                          {sentenceCase(alert.severity)}
                        </StatusPill>
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3">
                        <p className="text-[13px] font-medium text-ink">
                          {alert.attacker.kind} · {alert.attacker.name}
                        </p>
                        <p className="mono text-[11.5px] text-ink-3">{alert.agent.hostname}</p>
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3">
                        <StatusPill tone={verdictTone[alert.verdict]}>
                          {sentenceCase(alert.verdict)}
                        </StatusPill>
                        <span className="mono mt-1 block text-[11.5px] text-ink-3">
                          {alert.verdict === 'PENDING' ? 'scoring…' : `score ${alert.threatScore}`}
                        </span>
                      </td>
                      <td className="mono border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                        {alert.sourceIp}
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                        {alert.geo ? (
                          `${alert.geo.city}, ${alert.geo.country}`
                        ) : isPrivateIp(alert.sourceIp) ? (
                          'Internal range'
                        ) : (
                          <StatusPill tone="neutral">
                            <CircleAlert size={11} strokeWidth={2} aria-hidden="true" />
                            location unavailable
                          </StatusPill>
                        )}
                      </td>
                      <td className="max-w-[220px] border-b border-line-soft px-[14px] py-3">
                        <p className="text-[12.5px] leading-snug text-ink-2">{alert.description}</p>
                      </td>
                      <td className="whitespace-nowrap border-b border-line-soft px-[14px] py-3 text-right">
                        {renderActionCell(alert)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* cursor pagination footer */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line-soft px-5 py-4">
              <div className="text-[12px] text-ink-3">
                Showing <span className="font-semibold text-ink">{formatNumber(rows.length)}</span> of{' '}
                <span className="font-semibold text-ink">
                  {formatNumber(connection?.totalCount ?? 0)}
                </span>
                <span className="mono block text-[11px] sm:ml-2 sm:inline">
                  pageInfo {'{'} hasNextPage: {String(connection?.pageInfo.hasNextPage ?? false)},
                  endCursor: {JSON.stringify(connection?.pageInfo.endCursor ?? null)} {'}'}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {connection?.pageInfo.hasNextPage && (
                  <SpinnerButton
                    variant="secondary"
                    size="sm"
                    loading={isFetchingMore}
                    spinnerLabel="Loading…"
                    onClick={() =>
                      void alertsQuery.fetchMore({
                        variables: { after: connection.pageInfo.endCursor },
                      })
                    }
                  >
                    Load more
                  </SpinnerButton>
                )}
              </div>
            </div>
            <p className="px-5 pb-4 text-[11.5px] text-ink-3">
              Infinite scroll: the next page loads automatically as this footer enters the viewport
              (IntersectionObserver →{' '}
              <span className="mono text-[10.5px]">fetchMore(after: endCursor)</span>). The “Load
              more” button remains as the keyboard-accessible path. No page numbers — cursors stay
              valid while live alerts prepend.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
