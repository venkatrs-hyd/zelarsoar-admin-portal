/**
 * Incidents (route `/incidents`) — per design/soar-incidents.md + incidents.html mockup.
 *
 * Regions: lifecycle stat cards, incidents connection table with a focus-trapped
 * detail drawer (incident(id) + updateIncidentStatus transitions), a `incidentUpdated`
 * subscription that updates rows in place (LiveBadge), and a createIncident dialog.
 */
import { useMemo, useState } from 'react';
import { gql, useQuery, useSubscription } from '@apollo/client';
import { ChevronRight, Flag, Plus, ShieldCheck } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  LiveBadge,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  TableSkeleton,
  severityTone,
} from '@/components';
import { cn } from '@/lib/utils';
import { formatNumber, sentenceCase, timeAgo } from '@/lib/format';
import type { Connection, Incident, IncidentStatus } from '@/graphql/types';
import { IncidentDrawer } from '@/components/incidents/IncidentDrawer';
import { CreateIncidentDialog } from '@/components/incidents/CreateIncidentDialog';
import { statusTone } from '@/components/incidents/statusTone';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const INCIDENTS = gql`
  query Incidents($first: Int, $after: String, $filter: IncidentFilter) {
    incidents(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          ref
          title
          status
          severity
          assignee
          createdAt
          updatedAt
          tenant {
            id
            name
          }
          timeline {
            actor
            kind
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const INCIDENT_UPDATED = gql`
  subscription IncidentUpdated {
    incidentUpdated {
      id
      ref
      status
      updatedAt
    }
  }
`;

interface IncidentsResult {
  incidents: Connection<Incident>;
}

type ListIncident = Pick<
  Incident,
  'id' | 'ref' | 'title' | 'status' | 'severity' | 'assignee' | 'createdAt' | 'updatedAt' | 'tenant' | 'timeline'
>;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Incidents() {
  const incidents = useQuery<IncidentsResult>(INCIDENTS, { variables: { first: 10 } });
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const sub = useSubscription<{ incidentUpdated: Pick<Incident, 'id' | 'ref' | 'status' | 'updatedAt'> }>(
    INCIDENT_UPDATED,
    {
      onData: ({ data }) => {
        const inc = data.data?.incidentUpdated;
        if (inc) setLiveNote(`${inc.ref} was updated by the live feed.`);
      },
    },
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(
    () => (incidents.data?.incidents.edges ?? []).map((e) => e.node as ListIncident),
    [incidents.data],
  );
  const pageInfo = incidents.data?.incidents.pageInfo;
  const totalCount = incidents.data?.incidents.totalCount ?? 0;

  const counts = useMemo(() => {
    const c: Record<IncidentStatus, number> & { critical: number } = {
      OPEN: 0,
      INVESTIGATING: 0,
      CONTAINED: 0,
      CLOSED: 0,
      critical: 0,
    };
    rows.forEach((r) => {
      c[r.status] += 1;
      if (r.severity === 'CRITICAL') c.critical += 1;
    });
    return c;
  }, [rows]);

  const needsAttention = counts.OPEN + counts.INVESTIGATING;

  const traceId =
    (incidents.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (incidents.error ? 'net-local' : undefined);

  /* ---- full failure ---- */
  if (incidents.error && !incidents.data) {
    return (
      <ErrorCard
        title="Incidents didn’t load"
        message={
          <>
            The query <span className="mono text-[12px]">incidents(first: 10)</span> failed. Active response
            playbooks keep running in the background.
          </>
        }
        traceId={traceId}
        boundary="IncidentsView"
        onRetry={() => void incidents.refetch()}
      />
    );
  }

  const loading = incidents.loading && !incidents.data;

  /* ---- empty ---- */
  if (!loading && incidents.data && totalCount === 0) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[15px] text-ink-2">
            <span className="font-semibold text-ink">All clear.</span>{' '}
            <span className="text-ink-3">The engine is watching every tenant.</span>
          </p>
          <button type="button" className="btn btn-primary ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
            New incident
          </button>
        </div>
        <EmptyState
          icon={ShieldCheck}
          title="Nothing needs you right now"
          message="New incidents appear here the moment something needs a human — everything else is handled for you."
        />
        <p className="text-center text-[12px] text-ink-3">
          Last incident closed 6 days ago · mean time to contain: 38 min
        </p>
        <CreateIncidentDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  return (
    <>
      {/* status sentence + actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">
            {loading
              ? 'Gathering incident summary…'
              : `${needsAttention} incident${needsAttention === 1 ? '' : 's'} need${needsAttention === 1 ? 's' : ''} attention.`}
          </span>{' '}
          {!loading && <span className="text-ink-3">Everything else is contained or closed.</span>}
        </p>
        <button type="button" className="btn btn-primary ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
          New incident
        </button>
      </div>

      {/* lifecycle summary */}
      <section aria-label="Incident lifecycle summary">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-busy="true">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Open"
              value={<span className="text-sev-critical-ink">{formatNumber(counts.OPEN)}</span>}
              sub="needs a human"
            />
            <StatCard
              label="Investigating"
              value={<span className="text-sev-high-ink">{formatNumber(counts.INVESTIGATING)}</span>}
              sub="in progress"
            />
            <StatCard
              label="Contained"
              value={<span className="text-sev-medium-ink">{formatNumber(counts.CONTAINED)}</span>}
              sub="damage stopped"
            />
            <StatCard
              label="Closed"
              value={<span className="text-calm">{formatNumber(counts.CLOSED)}</span>}
              sub="fully resolved"
            />
            <StatCard
              label="Critical"
              value={<span className="text-sev-critical-ink">{formatNumber(counts.critical)}</span>}
              sub="highest severity"
            />
            <StatCard label="Total" value={formatNumber(totalCount)} sub="across 8 tenants" />
          </div>
        )}
      </section>

      {/* incidents table */}
      <Card className="overflow-hidden" aria-labelledby="inc-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
          <div>
            <h2 id="inc-h" className="font-display text-[15px] font-semibold">
              Incidents
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">Open a row to see the timeline and act on it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge active={!sub.error} label={sub.error ? 'Reconnecting…' : 'Live'} />
            <GqlChip kind="query">query incidents(first: 10, after: $cursor)</GqlChip>
            <GqlChip kind="subscription">subscription incidentUpdated</GqlChip>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {liveNote}
        </p>

        {loading ? (
          <div className="px-2 pb-4">
            <TableSkeleton
              rows={5}
              columns={['w-20', 'w-full', 'w-16', 'w-24', 'w-24', 'w-20', 'w-14', 'w-20', 'w-6']}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse">
                <thead>
                  <tr>
                    {['ID', 'Title', 'Severity', 'Status', 'Source', 'Agent', 'Created', 'Assigned', ''].map(
                      (h, i) => (
                        <th
                          key={h || 'open'}
                          scope="col"
                          className={cn(
                            'border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase',
                            i === 8 && 'w-10',
                          )}
                        >
                          {h}
                          {i === 8 && <span className="sr-only">Open</span>}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-[#FCFBF7]"
                      onClick={() => {
                        setSelectedId(row.id);
                        setDrawerOpen(true);
                      }}
                    >
                      <td className="mono border-b border-line-soft px-[14px] py-3 text-[12px] text-ink-3">
                        {row.ref}
                      </td>
                      <td className="max-w-[280px] border-b border-line-soft px-[14px] py-3">
                        <p className="truncate text-[13px] font-medium text-ink">{row.title}</p>
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3">
                        <StatusPill tone={severityTone(row.severity)}>{sentenceCase(row.severity)}</StatusPill>
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3">
                        <StatusPill tone={statusTone(row.status)} dot>
                          {sentenceCase(row.status)}
                        </StatusPill>
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                        {row.tenant.name}
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                        {row.timeline[0]?.actor ?? 'SOAR Engine'}
                      </td>
                      <td className="mono border-b border-line-soft px-[14px] py-3 text-[11.5px] text-ink-3">
                        {timeAgo(row.createdAt)}
                      </td>
                      <td className="border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                        {row.assignee ?? <span className="text-ink-3">Unassigned</span>}
                      </td>
                      <td className="border-b border-line-soft px-[10px] py-3">
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center rounded-[8px] text-ink-3 hover:bg-brand-tint hover:text-brand-ink"
                          aria-label={`Open details for ${row.ref}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(row.id);
                            setDrawerOpen(true);
                          }}
                        >
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
              <span className="text-[12px] text-ink-3">
                {rows.length} of {formatNumber(totalCount)} ·{' '}
                <span className="mono text-[11px]">
                  pageInfo.hasNextPage: {String(pageInfo?.hasNextPage ?? false)}
                </span>
              </span>
              {pageInfo?.hasNextPage && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={incidents.loading}
                  onClick={() =>
                    void incidents.fetchMore({
                      variables: { after: incidents.data?.incidents.pageInfo.endCursor },
                    })
                  }
                >
                  Load more
                </button>
              )}
            </div>
          </>
        )}
      </Card>

      {/* footer note + drawer + dialog */}
      <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
        <Flag size={12} aria-hidden="true" />
        Status changes made in the drawer update this table in place — no refresh needed.
      </p>
      <IncidentDrawer incidentId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <CreateIncidentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
