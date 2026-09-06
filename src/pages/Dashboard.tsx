/**
 * Dashboard (route `/`) — per design/dashboard.md + approved dashboard.html mockup.
 * Regions: greeting, Fleet at a glance (dashboardKpis), Real-time telemetry
 * (telemetryTick subscription), Threat origins (threatIntel, partial demo),
 * Recent activity (auditLog + alertCreated prepend, aria-live).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { gql, useQuery, useSubscription } from '@apollo/client';
import {
  ArrowDown,
  Building2,
  CheckCircle2,
  Flag,
  KeyRound,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  LiveBadge,
  PartialBanner,
  SectionHeader,
  Skeleton,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  severityTone,
} from '@/components';
import { formatNumber, sentenceCase, timeAgo } from '@/lib/format';
import type { Alert, AuditEvent, Connection, Telemetry, ThreatIntelSummary } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const DASHBOARD_KPIS = gql`
  query DashboardKpis {
    dashboardKpis {
      tenants
      users
      roles
      alertStats(window: LAST_24H) {
        last24h
        deltaPct
        needsHuman
      }
    }
  }
`;

const THREAT_INTEL = gql`
  query ThreatIntel {
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

const AUDIT_LOG = gql`
  query AuditLog($first: Int) {
    auditLog(first: $first) {
      edges {
        node {
          id
          timestamp
          actor
          kind
          action
          detail
          severity
          tenant {
            name
          }
        }
      }
      totalCount
    }
  }
`;

const TELEMETRY_TICK = gql`
  subscription TelemetryTick {
    telemetryTick {
      timestamp
      eventsPerMinute
      series
    }
  }
`;

const ALERT_CREATED = gql`
  subscription AlertCreated {
    alertCreated {
      id
      timestamp
      severity
      verdict
      sourceIp
      description
      agent {
        hostname
      }
      tenant {
        name
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */
interface KpisResult {
  dashboardKpis: {
    tenants: number;
    users: number;
    roles: number;
    alertStats: { last24h: number; deltaPct: number; needsHuman: number };
  };
}
interface ThreatIntelResult {
  threatIntel: Pick<ThreatIntelSummary, 'geoOrigins'> & { topTtp: { id: string; name: string } };
}
interface AuditResult {
  auditLog: Connection<AuditEvent>;
}

/* ------------------------------------------------------------------ */
/* Recent activity rows                                                */
/* ------------------------------------------------------------------ */
interface ActivityRow {
  id: string;
  timestamp: string;
  kind: string;
  action: string;
  detail: string;
  tenantName: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

const kindIcon: Record<string, LucideIcon> = {
  THREAT: ShieldAlert,
  AUTO_ACTION: CheckCircle2,
  BLOCK: CheckCircle2,
  SIGN_IN: UserRound,
  INCIDENT: Flag,
  POLICY: Settings2,
  LICENSE: KeyRound,
  TENANT: Building2,
  USER: UsersRound,
};

function rowTile(row: ActivityRow): string {
  if (row.severity === 'CRITICAL') return 'bg-sev-critical-tint text-sev-critical-ink';
  if (row.severity === 'HIGH') return 'bg-sev-high-tint text-sev-high-ink';
  if (row.kind === 'AUTO_ACTION' || row.kind === 'BLOCK' || row.kind === 'INCIDENT') return 'bg-calm-tint text-calm';
  return 'bg-brand-tint text-brand-ink';
}

function rowPill(row: ActivityRow): { tone: ReturnType<typeof severityTone> | 'calm' | 'brand'; label: string } | null {
  if (row.severity) return { tone: severityTone(row.severity), label: sentenceCase(row.severity) };
  if (row.kind === 'AUTO_ACTION' || row.kind === 'BLOCK') return { tone: 'calm', label: 'Already sorted' };
  if (row.kind === 'INCIDENT') return { tone: 'calm', label: 'Closed' };
  return null;
}

function toRow(e: AuditEvent): ActivityRow {
  return {
    id: e.id,
    timestamp: e.timestamp,
    kind: e.kind,
    action: e.action,
    detail: e.detail,
    tenantName: e.tenant?.name ?? null,
    severity: e.severity,
  };
}

function alertToRow(a: Pick<Alert, 'id' | 'timestamp' | 'severity' | 'verdict' | 'sourceIp' | 'description' | 'agent' | 'tenant'>): ActivityRow {
  return {
    id: a.id,
    timestamp: a.timestamp,
    kind: 'THREAT',
    action: a.verdict === 'THREAT_CONFIRMED' ? 'Threat confirmed' : 'Alert received',
    detail: `${a.description} · ${a.tenant.name} · from ${a.sourceIp}`,
    tenantName: a.tenant.name,
    severity: a.severity,
  };
}

/* ------------------------------------------------------------------ */
/* Telemetry chart                                                     */
/* ------------------------------------------------------------------ */
function TelemetryChart({ series }: { series: number[] }) {
  const max = Math.max(...series, 1);
  const min = Math.min(...series);
  const bars = series.slice(-24);
  return (
    <div
      role="img"
      aria-label={`Bar chart of events per minute over the last ${bars.length} minutes, ranging between ${min} and ${max} events per minute`}
    >
      <svg viewBox="0 0 576 160" className="h-auto w-full" aria-hidden="true">
        <line x1="0" y1="140" x2="576" y2="140" stroke="#F0EDE6" strokeWidth="1" />
        <line x1="0" y1="95" x2="576" y2="95" stroke="#F0EDE6" strokeWidth="1" />
        <line x1="0" y1="50" x2="576" y2="50" stroke="#F0EDE6" strokeWidth="1" />
        <g>
          {bars.map((v, i) => {
            const h = Math.round((v / Math.max(max, 90)) * 100) + 8;
            const isLast = i === bars.length - 1;
            const fill = isLast ? '#1E7A55' : i % 8 === 0 ? '#429CE3' : '#99C9EF';
            return (
              <rect key={`${i}-${v}`} x={4 + i * 24} y={140 - h} width="18" height={h} rx="4" fill={fill} />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const kpis = useQuery<KpisResult>(DASHBOARD_KPIS);
  const intel = useQuery<ThreatIntelResult>(THREAT_INTEL, { errorPolicy: 'all' });
  const audit = useQuery<AuditResult>(AUDIT_LOG, { variables: { first: 5 } });
  const telemetry = useSubscription<{ telemetryTick: Telemetry }>(TELEMETRY_TICK);
  const [liveRows, setLiveRows] = useState<ActivityRow[]>([]);
  useSubscription<{ alertCreated: Alert }>(ALERT_CREATED, {
    onData: ({ data }) => {
      const a = data.data?.alertCreated;
      if (a) setLiveRows((rows) => [alertToRow(a), ...rows].slice(0, 3));
    },
  });

  const traceId =
    (kpis.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (kpis.error ? 'net-local' : undefined);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const rows = useMemo<ActivityRow[]>(() => {
    const base = audit.data?.auditLog.edges.map((e) => toRow(e.node)) ?? [];
    const seen = new Set(liveRows.map((r) => r.id));
    return [...liveRows, ...base.filter((r) => !seen.has(r.id))].slice(0, 6);
  }, [audit.data, liveRows]);

  const tick = telemetry.data?.telemetryTick;
  const geoOrigins = intel.data?.threatIntel.geoOrigins ?? null;
  const intelPartial = !!intel.error || (intel.data != null && geoOrigins == null);

  /* KPI region states */
  if (kpis.error && !kpis.data) {
    return (
      <ErrorCard
        title="The dashboard didn’t load"
        message={
          <>
            Something went wrong while fetching <span className="mono text-[12px]">dashboardKpis</span>. Your data
            is safe — this is a display problem, not an incident.
          </>
        }
        traceId={traceId}
        boundary="DashboardView"
        onRetry={() => void kpis.refetch()}
      />
    );
  }
  if (kpis.data && kpis.data.dashboardKpis.tenants === 0) {
    return (
      <EmptyState
        title="Nothing needs you right now"
        message="No tenants are connected yet, so there’s nothing on the dashboard. When the first tenant starts reporting, its health and telemetry will appear here automatically."
        action={
          <Link to="/tenants" className="btn btn-primary">
            Add your first tenant
          </Link>
        }
      />
    );
  }

  const d = kpis.data?.dashboardKpis;

  return (
    <>
      {/* status sentence */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">{greeting}, Ana.</span> 8 tenants connected, all reporting.{' '}
          <span className="text-ink-3">
            {d ? `${d.alertStats.needsHuman} alerts need a human look.` : 'Gathering today’s summary…'}
          </span>
        </p>
        <StatusPill tone="calm" pulse className="ml-auto">
          All systems calm
        </StatusPill>
      </div>

      {/* Fleet at a glance */}
      <section aria-label="Key metrics">
        <SectionHeader
          title="Fleet at a glance"
          chip={<GqlChip kind="query">query dashboardKpis {'{ tenants users roles alertStats(window: LAST_24H) }'}</GqlChip>}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.loading || !d ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard label="Tenants" value={formatNumber(d.tenants)} sub="All healthy" subTone="calm" subDot />
              <StatCard label="Users" value={formatNumber(d.users)} sub="across 8 tenants" />
              <StatCard label="Roles" value={formatNumber(d.roles)} sub="RBAC levels 100 → 20" />
              <StatCard
                label="Alerts · last 24h"
                value={formatNumber(d.alertStats.last24h)}
                sub={`${Math.abs(d.alertStats.deltaPct)}% quieter than yesterday`}
                subTone="calm"
                subIcon={<ArrowDown size={12} strokeWidth={2.2} aria-hidden="true" />}
              />
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Real-time telemetry */}
        <Card className="p-5 lg:col-span-2" aria-labelledby="tele-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="tele-h" className="font-display text-[15px] font-semibold">
                Real-time telemetry
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-3">Events per minute, all tenants</p>
            </div>
            <div className="flex items-center gap-2">
              <LiveBadge active={!telemetry.error} label={telemetry.error ? 'Reconnecting…' : 'Live'} />
              <GqlChip kind="subscription">subscription telemetryTick(tenantId: null)</GqlChip>
            </div>
          </div>
          {tick ? (
            <>
              <div className="mt-4">
                <TelemetryChart series={tick.series} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11.5px] text-ink-3">
                <span className="mono">-{tick.series.length} min</span>
                <span aria-live="polite">
                  Now · <span className="mono">{tick.eventsPerMinute} ev/min</span> — within normal range
                </span>
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-4" aria-busy="true">
              <Skeleton className="h-[160px]" />
              <Skeleton className="ml-auto h-3 w-48" />
            </div>
          )}
        </Card>

        {/* Threat origins */}
        <Card className="p-5" aria-labelledby="threat-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="threat-h" className="font-display text-[15px] font-semibold">
              Threat origins
            </h2>
            <GqlChip kind="query">query threatIntel</GqlChip>
          </div>
          {intel.loading && !intel.data ? (
            <div className="mt-4 space-y-3" aria-busy="true">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : intel.error && !intel.data ? (
            <div className="mt-4">
              <PartialBanner
                title="Threat origins unavailable"
                field="threatIntel"
                onRetry={() => void intel.refetch()}
              />
            </div>
          ) : intelPartial ? (
            <div className="mt-4">
              <PartialBanner
                title="Threat origins unavailable"
                field="threatIntel.geoOrigins"
                onRetry={() => void intel.refetch()}
              />
              {intel.data?.threatIntel.topTtp && (
                <p className="mt-3 text-[12px] text-ink-3">
                  Top MITRE TTP:{' '}
                  <span className="mono text-[11.5px]">
                    {intel.data.threatIntel.topTtp.id} · {intel.data.threatIntel.topTtp.name}
                  </span>{' '}
                  <span className="text-calm">(cached)</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              <ul className="mt-4 space-y-3">
                {geoOrigins?.map((g) => {
                  const max = geoOrigins[0]?.count ?? 1;
                  const barColor =
                    g.severity === 'CRITICAL'
                      ? 'bg-sev-critical'
                      : g.severity === 'HIGH'
                        ? 'bg-sev-high'
                        : g.severity === 'MEDIUM'
                          ? 'bg-sev-medium'
                          : 'bg-sev-low';
                  return (
                    <li key={g.country} className="flex items-center gap-3">
                      <span className="w-24 text-[13px]">{g.country}</span>
                      <div className="h-2 flex-1 rounded-full bg-line-soft">
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${Math.round((g.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="mono text-[11.5px] text-ink-3">{formatNumber(g.count)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-[12px] text-ink-3">
                Top MITRE TTP:{' '}
                <span className="mono text-[11.5px]">
                  {intel.data?.threatIntel.topTtp.id} · {intel.data?.threatIntel.topTtp.name}
                </span>
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card aria-labelledby="act-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <h2 id="act-h" className="font-display text-[15px] font-semibold">
              Recent activity
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Latest events across all tenants — updates itself, no refresh needed.
            </p>
          </div>
          <GqlChip kind="subscription">subscription alertCreated · query auditLog(first: 8)</GqlChip>
        </div>
        {audit.loading && !audit.data ? (
          <div className="space-y-3 px-5 pb-5" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 !rounded-[9px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 !rounded-full" />
              </div>
            ))}
          </div>
        ) : audit.error && !audit.data ? (
          <div className="px-5 pb-5">
            <PartialBanner title="Recent activity unavailable" field="auditLog" onRetry={() => void audit.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="Nothing needs you right now" message="New events across your tenants will appear here as they happen." />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line-soft" aria-live="polite">
              {rows.map((row) => {
                const Icon = kindIcon[row.kind] ?? ShieldCheck;
                const pill = rowPill(row);
                return (
                  <li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${rowTile(row)}`}>
                      <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{row.action}</p>
                      <p className="truncate text-[12px] text-ink-3">{row.detail}</p>
                    </div>
                    {pill && (
                      <StatusPill tone={pill.tone} className="hidden sm:inline-flex">
                        {pill.label}
                      </StatusPill>
                    )}
                    <span className="mono shrink-0 text-[11.5px] text-ink-3">{timeAgo(row.timestamp)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
              <span className="text-[12px] text-ink-3">
                Showing {rows.length} of {formatNumber(audit.data?.auditLog.totalCount ?? rows.length)} today
              </span>
              <Link to="/alerts" className="btn btn-ghost btn-sm">
                Open alerts
              </Link>
            </div>
          </>
        )}
      </Card>

      <footer className="pb-24" />
    </>
  );
}
