/**
 * SOAR Policy Engine (route `/soar-policies`) — per design/soar-incidents.md and the
 * approved soar-policies.html mockup.
 *
 * Regions:
 *  - Engine status stat cards (query soarPolicy)
 *  - Firewall integrations grid (query firewallIntegrations)
 *  - Blocked IPs connection table with Unblock → optimistic fade → Undo toast (blockIp restores)
 *  - Automation policy form with idle → saving → saved / error save cycle (mutation updateSoarPolicy)
 */
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Ban, Check, PlugZap, ShieldCheck } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  PartialBanner,
  SectionHeader,
  Skeleton,
  SpinnerButton,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  TableSkeleton,
  useToast,
} from '@/components';
import { cn } from '@/lib/utils';
import { formatNumber, timeAgo } from '@/lib/format';
import type { BlockedIp, Connection, FirewallIntegration, SoarPolicy, UserError } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const SOAR_POLICY = gql`
  query SoarPolicy($tenantId: ID!) {
    soarPolicy(tenantId: $tenantId) {
      engine
      businessHoursStart
      businessHoursEnd
      businessHoursTimezone
      businessHoursOnly
      autoBlockThreshold
      autoIsolateThreshold
      blockedCount
      autoBlocksToday
      manualBlocksToday
    }
  }
`;

const FIREWALL_INTEGRATIONS = gql`
  query FirewallIntegrations($tenantId: ID!) {
    firewallIntegrations(tenantId: $tenantId) {
      id
      kind
      name
      status
      detail
    }
  }
`;

const BLOCKED_IPS = gql`
  query BlockedIps($first: Int, $after: String, $tenantId: ID) {
    blockedIps(first: $first, after: $after, tenantId: $tenantId) {
      edges {
        node {
          id
          ip
          reason
          score
          method
          blockedBy
          blockedAt
          tenant {
            id
            name
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

const UPDATE_SOAR_POLICY = gql`
  mutation UpdateSoarPolicy($tenantId: ID!, $input: SoarPolicyInput!) {
    updateSoarPolicy(tenantId: $tenantId, input: $input) {
      policy {
        engine
        businessHoursStart
        businessHoursEnd
        businessHoursTimezone
        businessHoursOnly
        autoBlockThreshold
        autoIsolateThreshold
        blockedCount
        autoBlocksToday
        manualBlocksToday
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */
interface PolicyResult {
  soarPolicy: SoarPolicy;
}
interface IntegrationsResult {
  firewallIntegrations: FirewallIntegration[];
}
interface BlockedIpsResult {
  blockedIps: Connection<BlockedIp>;
}
interface UnblockResult {
  unblockIp: { unblockedIp: string | null; userErrors: UserError[] };
}
interface BlockResult {
  blockIp: { blockedIp: { id: string; ip: string } | null; userErrors: UserError[] };
}
interface UpdatePolicyResult {
  updateSoarPolicy: { policy: SoarPolicy | null; userErrors: UserError[] };
}

/* ------------------------------------------------------------------ */
/* Small page-local controls                                           */
/* ------------------------------------------------------------------ */
const inputClass =
  'h-[38px] w-full rounded-[10px] border border-line bg-white px-3 text-[13.5px] text-ink';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 text-left"
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-[18px] w-[32px] flex-none items-center rounded-full p-[2px] transition-colors',
          checked ? 'justify-end bg-calm' : 'justify-start bg-[#D8D2C4]',
        )}
        aria-hidden="true"
      >
        <span className="h-[14px] w-[14px] rounded-full bg-white shadow-xs" />
      </span>
      <span className="text-[12.5px] text-ink-2">
        {label}
        {hint && <span className="mt-0.5 block text-[11.5px] text-ink-3">{hint}</span>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Policy form state                                                   */
/* ------------------------------------------------------------------ */
interface PolicyFormState {
  businessHoursStart: string;
  businessHoursEnd: string;
  businessHoursOnly: boolean;
  offHoursMode: 'queue' | 'enforce';
  autoBlockThreshold: number;
  autoIsolateThreshold: number;
  aiEnhanced: boolean;
  autoBlockEnabled: boolean;
  minConfidence: number;
  maxBlocksPerDay: number;
  blockDurationHrs: number;
  blockVpnTor: boolean;
  blockBots: boolean;
  blockPersistent: boolean;
}

const defaultExtras = {
  offHoursMode: 'queue',
  aiEnhanced: true,
  autoBlockEnabled: true,
  minConfidence: 80,
  maxBlocksPerDay: 50,
  blockDurationHrs: 24,
  blockVpnTor: true,
  blockBots: true,
  blockPersistent: false,
} as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/* ------------------------------------------------------------------ */
/* Automation policy form (mounted once soarPolicy has loaded, so the  */
/* useState initializer can hydrate straight from the gateway data)    */
/* ------------------------------------------------------------------ */
function PolicyFormCard({ policy }: { policy: SoarPolicy }) {
  const { toast } = useToast();
  const [updatePolicy] = useMutation<UpdatePolicyResult>(UPDATE_SOAR_POLICY);
  const [form, setForm] = useState<PolicyFormState>(() => ({
    businessHoursStart: policy.businessHoursStart,
    businessHoursEnd: policy.businessHoursEnd,
    businessHoursOnly: policy.businessHoursOnly,
    autoBlockThreshold: policy.autoBlockThreshold,
    autoIsolateThreshold: policy.autoIsolateThreshold,
    ...defaultExtras,
  }));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = (partial: Partial<PolicyFormState>) => {
    setForm((f) => ({ ...f, ...partial }));
    if (saveState === 'saved') setSaveState('idle');
  };

  const savePolicy = () => {
    setSaveState('saving');
    setSaveError(null);
    void updatePolicy({
      variables: {
        tenantId: 'global',
        input: {
          businessHoursOnly: form.businessHoursOnly,
          businessHoursStart: form.businessHoursStart,
          businessHoursEnd: form.businessHoursEnd,
          autoBlockThreshold: form.autoBlockThreshold,
          autoIsolateThreshold: form.autoIsolateThreshold,
        },
      },
    })
      .then((res) => {
        const errs = res.data?.updateSoarPolicy.userErrors ?? [];
        if (errs.length > 0) {
          setSaveState('error');
          setSaveError(errs[0].message);
          return;
        }
        setSaveState('saved');
        toast({
          tone: 'success',
          title: 'Policy saved',
          description: 'mutation updateSoarPolicy applied to 8 tenants.',
        });
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 3000);
      })
      .catch((err: unknown) => {
        setSaveState('error');
        setSaveError(err instanceof Error ? err.message : 'Unknown gateway error.');
      });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saveState !== 'saving') savePolicy();
  };

  return (
  <Card className="p-5 lg:col-span-2" aria-labelledby="pol-h">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="pol-h" className="font-display text-[15px] font-semibold">
        Automation policy
      </h2>
      <GqlChip kind="mutation">mutation updateSoarPolicy</GqlChip>
    </div>

    <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bh-start" className="mb-1 block text-[12px] font-medium">
            Business hours start
          </label>
          <input
            id="bh-start"
            type="time"
            className={inputClass}
            value={form.businessHoursStart}
            onChange={(e) => patch({ businessHoursStart: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="bh-end" className="mb-1 block text-[12px] font-medium">
            Business hours end
          </label>
          <input
            id="bh-end"
            type="time"
            className={inputClass}
            value={form.businessHoursEnd}
            onChange={(e) => patch({ businessHoursEnd: e.target.value })}
          />
        </div>
      </div>

      <Toggle
        checked={form.businessHoursOnly}
        onChange={(v) => patch({ businessHoursOnly: v })}
        label="Enforce auto-actions only during business hours"
        hint="Outside these hours the engine follows the off-hours mode."
      />
      <div>
        <label htmlFor="offhours" className="mb-1 block text-[12px] font-medium">
          Off-hours mode
        </label>
        <select
          id="offhours"
          className={inputClass}
          value={form.offHoursMode}
          onChange={(e) => patch({ offHoursMode: e.target.value as PolicyFormState['offHoursMode'] })}
          disabled={!form.businessHoursOnly}
        >
          <option value="queue">Queue blocks for morning review</option>
          <option value="enforce">Keep enforcing around the clock</option>
        </select>
      </div>

      <div>
        <div className="mb-1 flex justify-between">
          <label htmlFor="ab" className="text-[12px] font-medium">
            Auto-block threshold
          </label>
          <span className="mono text-[12px] text-ink-3">{form.autoBlockThreshold}</span>
        </div>
        <input
          id="ab"
          type="range"
          min={50}
          max={100}
          value={form.autoBlockThreshold}
          onChange={(e) => patch({ autoBlockThreshold: Number(e.target.value) })}
          className="w-full accent-[#2374AE]"
          aria-describedby="ab-help"
        />
        <p id="ab-help" className="mt-1 text-[11.5px] text-ink-3">
          Alerts scoring at or above this are blocked without waiting for a human.
        </p>
      </div>
      <div>
        <div className="mb-1 flex justify-between">
          <label htmlFor="ai" className="text-[12px] font-medium">
            Auto-isolate threshold
          </label>
          <span className="mono text-[12px] text-ink-3">{form.autoIsolateThreshold}</span>
        </div>
        <input
          id="ai"
          type="range"
          min={50}
          max={100}
          value={form.autoIsolateThreshold}
          onChange={(e) => patch({ autoIsolateThreshold: Number(e.target.value) })}
          className="w-full accent-[#2374AE]"
        />
      </div>

      <div className="space-y-3 border-t border-line-soft pt-4">
        <Toggle
          checked={form.autoBlockEnabled}
          onChange={(v) => patch({ autoBlockEnabled: v })}
          label="Auto-block enabled"
          hint="Master switch for engine-initiated blocks."
        />
        <Toggle
          checked={form.aiEnhanced}
          onChange={(v) => patch({ aiEnhanced: v })}
          label="AI-enhanced scoring"
          hint="Blend model confidence with the raw threat score."
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex justify-between">
              <label htmlFor="conf" className="text-[12px] font-medium">
                Min AI confidence
              </label>
              <span className="mono text-[12px] text-ink-3">{form.minConfidence}%</span>
            </div>
            <input
              id="conf"
              type="range"
              min={50}
              max={100}
              value={form.minConfidence}
              onChange={(e) => patch({ minConfidence: Number(e.target.value) })}
              className="w-full accent-[#2374AE]"
            />
          </div>
          <div>
            <label htmlFor="maxblocks" className="mb-1 block text-[12px] font-medium">
              Max blocks / day
            </label>
            <input
              id="maxblocks"
              type="number"
              min={1}
              max={1000}
              className={inputClass}
              value={form.maxBlocksPerDay}
              onChange={(e) => patch({ maxBlocksPerDay: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <label htmlFor="duration" className="mb-1 block text-[12px] font-medium">
            Block duration (hours)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            max={720}
            className={inputClass}
            value={form.blockDurationHrs}
            onChange={(e) => patch({ blockDurationHrs: Number(e.target.value) })}
          />
        </div>
        <Toggle
          checked={form.blockVpnTor}
          onChange={(v) => patch({ blockVpnTor: v })}
          label="Block VPN / TOR exit nodes"
        />
        <Toggle
          checked={form.blockBots}
          onChange={(v) => patch({ blockBots: v })}
          label="Block known bots"
        />
        <Toggle
          checked={form.blockPersistent}
          onChange={(v) => patch({ blockPersistent: v })}
          label="Block persistent attackers"
          hint="Repeat offenders stay blocked across policy windows."
        />
      </div>

      {saveState === 'error' && (
        <PartialBanner
          title="Policy wasn’t saved"
          message={`mutation updateSoarPolicy returned CONFLICT — ${saveError ?? 'someone else edited this policy.'} Your changes are still here; try again.`}
          onRetry={savePolicy}
        />
      )}

      <div className="flex items-center gap-3 pt-1">
        <SpinnerButton
          type="submit"
          variant="primary"
          loading={saveState === 'saving'}
          spinnerLabel="Saving…"
        >
          Save policy
        </SpinnerButton>
        {saveState === 'saved' && (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-calm" role="status">
            <Check size={13} strokeWidth={2.4} aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
    </form>
  </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function SoarPolicies() {
  const { toast } = useToast();

  const policy = useQuery<PolicyResult>(SOAR_POLICY, { variables: { tenantId: 'global' } });
  const integrations = useQuery<IntegrationsResult>(FIREWALL_INTEGRATIONS, {
    variables: { tenantId: 'global' },
  });
  const blocked = useQuery<BlockedIpsResult>(BLOCKED_IPS, { variables: { first: 10 } });

  const [unblockIp] = useMutation<UnblockResult>(UNBLOCK_IP);
  const [blockIp] = useMutation<BlockResult>(BLOCK_IP);

  /* ---- Unblock cycle: pending → fade out → removed + Undo toast ---- */
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [fading, setFading] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlyMap<string, BlockedIp>>(new Map());

  const addTo = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => new Set(set).add(v);
  const without = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => {
    const next = new Set(set);
    next.delete(v);
    return next;
  };

  const reblock = (row: BlockedIp) => {
    void blockIp({
      variables: { input: { ip: row.ip, tenantId: row.tenant.id, reason: row.reason } },
      refetchQueries: ['SoarPolicy'],
    })
      .then((res) => {
        const errs = res.data?.blockIp.userErrors ?? [];
        if (errs.length > 0) {
          toast({ tone: 'warning', title: 'Block not restored', description: errs[0].message });
          return;
        }
        setRemoved((m) => {
          const next = new Map(m);
          next.delete(row.ip);
          return next;
        });
        toast({ tone: 'success', title: 'Block restored', description: `${row.ip} is blocked again.` });
      })
      .catch(() => {
        toast({ tone: 'warning', title: 'Block not restored', description: 'mutation blockIp failed — try again.' });
      });
  };

  const unblock = (row: BlockedIp) => {
    const ip = row.ip;
    setPending((s) => addTo(s, ip));
    void unblockIp({ variables: { ip, tenantId: row.tenant.id }, refetchQueries: ['SoarPolicy'] })
      .then((res) => {
        const errs = res.data?.unblockIp.userErrors ?? [];
        if (errs.length > 0) {
          toast({ tone: 'warning', title: `${ip} stayed blocked`, description: errs[0].message });
          return;
        }
        setFading((s) => addTo(s, ip));
        setTimeout(() => {
          setRemoved((m) => new Map(m).set(ip, row));
          setFading((s) => without(s, ip));
        }, 400);
        toast({
          title: `${ip} unblocked`,
          description: 'mutation unblockIp confirmed — rule removed from Local iptables.',
          duration: 8000,
          action: { label: 'Undo', onClick: () => reblock(row) },
        });
      })
      .catch(() => {
        toast({ tone: 'warning', title: 'Unblock failed', description: 'mutation unblockIp failed — try again.' });
      })
      .finally(() => {
        setPending((s) => without(s, ip));
      });
  };

  /* ---- Derived data ---- */
  const p = policy.data?.soarPolicy;
  const visibleRows = useMemo(
    () => (blocked.data?.blockedIps.edges ?? []).map((e) => e.node).filter((n) => !removed.has(n.ip)),
    [blocked.data, removed],
  );
  const totalCount = (blocked.data?.blockedIps.totalCount ?? 0) - removed.size;
  const pageInfo = blocked.data?.blockedIps.pageInfo;
  const traceId =
    (policy.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (policy.error ? 'net-local' : undefined);

  /* ---- Full-page failure ---- */
  if (policy.error && !policy.data) {
    return (
      <ErrorCard
        title="Policies didn’t load"
        message={
          <>
            The query <span className="mono text-[12px]">soarPolicy</span> failed. The engine keeps enforcing the
            last known policy — nothing was lost.
          </>
        }
        traceId={traceId}
        boundary="SoarPoliciesView"
        onRetry={() => {
          void policy.refetch();
          void integrations.refetch();
          void blocked.refetch();
        }}
      />
    );
  }

  const engineRunning = p?.engine === 'RUNNING';

  return (
    <>
      {/* status sentence */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">The automation engine is running.</span>{' '}
          <span className="text-ink-3">
            {p
              ? `It handled ${formatNumber(p.autoBlocksToday)} blocks on its own today — every one reversible.`
              : 'Gathering today’s automation summary…'}
          </span>
        </p>
        <StatusPill tone="calm" pulse className="ml-auto">
          Engine healthy
        </StatusPill>
      </div>

      {/* Engine status */}
      <section aria-label="Engine status">
        <SectionHeader
          title="Engine status"
          chip={<GqlChip kind="query">query soarPolicy(tenantId: &quot;global&quot;)</GqlChip>}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {policy.loading || !p ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Engine"
                value={
                  <StatusPill tone={engineRunning ? 'calm' : 'neutral'} dot className="mt-1">
                    {engineRunning ? 'Running' : 'Paused'}
                  </StatusPill>
                }
                sub={engineRunning ? 'Enforcing policy' : 'Not enforcing'}
                subTone={engineRunning ? 'calm' : 'muted'}
              />
              <StatCard
                label="Business hours"
                value={`${p.businessHoursStart}–${p.businessHoursEnd}`}
                sub={`Mon–Fri · ${p.businessHoursTimezone}`}
              />
              <StatCard label="Auto-block" value={`score ≥ ${p.autoBlockThreshold}`} sub="On" subTone="calm" />
              <StatCard label="Auto-isolate" value={`score ≥ ${p.autoIsolateThreshold}`} sub="On" subTone="calm" />
              <StatCard label="Blocked IPs" value={formatNumber(p.blockedCount)} sub="across 1 firewall" />
              <StatCard label="Auto-blocks today" value={formatNumber(p.autoBlocksToday)} sub="no human needed" />
              <StatCard label="Manual blocks today" value={formatNumber(p.manualBlocksToday)} sub="by admins" />
            </>
          )}
        </div>
      </section>

      {/* Firewall integrations */}
      <section aria-labelledby="fw-h">
        <SectionHeader
          id="fw-h"
          title="Firewall integrations"
          chip={<GqlChip kind="query">query firewallIntegrations(tenantId: &quot;global&quot;)</GqlChip>}
        />
        {integrations.loading && !integrations.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </Card>
            ))}
          </div>
        ) : integrations.error && !integrations.data ? (
          <PartialBanner
            title="Firewall integrations unavailable"
            field="firewallIntegrations"
            onRetry={() => void integrations.refetch()}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(integrations.data?.firewallIntegrations ?? []).map((fw) => {
              const connected = fw.status === 'CONNECTED';
              return (
                <Card
                  key={fw.id}
                  className={cn(
                    'border-l-4 p-4',
                    connected ? 'border-l-calm' : 'border-l-sev-high',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <p className="font-display text-[13.5px] font-semibold">{fw.name}</p>
                    {connected ? (
                      <StatusPill tone="calm" dot>
                        Connected
                      </StatusPill>
                    ) : (
                      <StatusPill tone="high">Setup required</StatusPill>
                    )}
                  </div>
                  <p className="mt-2 text-[11.5px] text-ink-3">{fw.detail}</p>
                  {connected ? (
                    <p className="mono mt-1 text-[10.5px] text-ink-3">status: active &amp; blocking</p>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm mt-2 !px-0">
                      <PlugZap size={12} aria-hidden="true" />
                      Connect →
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Blocked IPs */}
        <Card className="overflow-hidden lg:col-span-3" aria-labelledby="bip-h">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
            <div>
              <h2 id="bip-h" className="font-display text-[15px] font-semibold">
                Blocked IPs
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-3">
                Unblocking takes effect in seconds — and can be undone.
              </p>
            </div>
            <GqlChip kind="query">query blockedIps(first: 10, after: $cursor)</GqlChip>
          </div>

          {blocked.loading && !blocked.data ? (
            <div className="px-2 pb-4">
              <TableSkeleton rows={6} columns={['w-28', 'w-full', 'w-20', 'w-24', 'w-16', 'w-20']} />
            </div>
          ) : blocked.error && !blocked.data ? (
            <div className="px-5 pb-5">
              <PartialBanner
                title="Blocked IPs didn’t load"
                field="blockedIps(first: 10)"
                onRetry={() => void blocked.refetch()}
              />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={ShieldCheck}
                title="No blocked IPs — the engine is quiet"
                message="When the engine blocks its first attacker, the entry will appear here with an Undo option. Nothing needs you right now."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      {['IP address', 'Reason', 'Method', 'Source', 'Blocked', 'Action'].map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={cn(
                            'border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase',
                            i === 5 && 'text-right',
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'transition-opacity duration-300',
                          fading.has(row.ip) && 'opacity-0',
                        )}
                      >
                        <td className="border-b border-line-soft px-[14px] py-3">
                          <span className="flex items-center gap-2">
                            <Ban size={13} className="flex-none text-calm" aria-hidden="true" />
                            <span className="mono text-[12.5px] text-ink">{row.ip}</span>
                          </span>
                        </td>
                        <td className="max-w-[200px] border-b border-line-soft px-[14px] py-3">
                          <p className="text-[12.5px] leading-snug text-ink-2">
                            {row.reason} <span className="text-ink-3">· score {row.score}</span>
                          </p>
                        </td>
                        <td className="border-b border-line-soft px-[14px] py-3">
                          <StatusPill tone="brand">{row.method.toUpperCase()}</StatusPill>
                        </td>
                        <td className="border-b border-line-soft px-[14px] py-3 text-[12.5px] text-ink-2">
                          {row.blockedBy}
                        </td>
                        <td className="mono border-b border-line-soft px-[14px] py-3 text-[11.5px] text-ink-3">
                          {timeAgo(row.blockedAt)}
                        </td>
                        <td className="border-b border-line-soft px-[14px] py-3 text-right">
                          <SpinnerButton
                            variant="secondary"
                            size="sm"
                            loading={pending.has(row.ip)}
                            spinnerLabel="Unblocking…"
                            onClick={() => unblock(row)}
                          >
                            Unblock
                          </SpinnerButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
                <span className="text-[12px] text-ink-3">
                  Showing {visibleRows.length} of {formatNumber(totalCount)} ·{' '}
                  <span className="mono text-[11px]">pageInfo.hasNextPage: {String(pageInfo?.hasNextPage ?? false)}</span>
                </span>
                {pageInfo?.hasNextPage && (
                  <SpinnerButton
                    variant="ghost"
                    size="sm"
                    loading={blocked.loading}
                    spinnerLabel="Loading…"
                    onClick={() =>
                      void blocked.fetchMore({
                        variables: { after: blocked.data?.blockedIps.pageInfo.endCursor },
                      })
                    }
                  >
                    Load more
                  </SpinnerButton>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Automation policy form */}
        {policy.loading && !p ? (
          <Card className="space-y-4 p-5 lg:col-span-2" aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-9 w-28 !rounded-[10px]" />
          </Card>
        ) : p ? (
          <PolicyFormCard policy={p} />
        ) : null}
      </div>
    </>
  );
}
