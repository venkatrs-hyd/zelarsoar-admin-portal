/**
 * Licensing (route `/licensing`) — per design/fleet.md (table/stat grammar of
 * tenants.html; no separate mockup).
 * 6 stat cards from query licenses; Active License Inventory with Upgrade
 * (tier dialog → grantLicense) and Revoke (confirm → optimistic removal + Undo
 * toast); Unlicensed Tenants with Trial/Enterprise/Business grant buttons whose
 * rows move into the inventory optimistically.
 */
import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import type { Reference } from '@apollo/client';
import { BadgeCheck, CircleX, Clock, KeyRound } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  SpinnerButton,
  StatCard,
  StatCardSkeleton,
  StatusPill,
  TableSkeleton,
  useToast,
} from '@/components';
import type { PillTone } from '@/components';
import { FleetModal } from '@/components/fleet/Modal';
import { inputClass, labelClass } from '@/components/fleet/fields';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import type { License, LicenseTier, Tenant, UserError } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const LICENSE_FIELDS = gql`
  fragment LicenseRow on License {
    id
    tier
    status
    key
    issuedAt
    expiresAt
    seatsUsed
    seatsTotal
    alertQuotaUsed
    alertQuotaTotal
    agentsUsed
    agentsTotal
    tenant {
      id
      name
      slug
      tier
      licensed
    }
  }
`;

const LICENSES = gql`
  query Licenses {
    licenses {
      ...LicenseRow
    }
  }
  ${LICENSE_FIELDS}
`;

const TENANTS_FOR_LICENSES = gql`
  query UnlicensedTenants {
    tenants(first: 50) {
      edges {
        node {
          id
          name
          slug
          tier
          licensed
        }
      }
      totalCount
    }
  }
`;

const GRANT_LICENSE = gql`
  mutation GrantLicense($tenantId: ID!, $tier: LicenseTier!) {
    grantLicense(tenantId: $tenantId, tier: $tier) {
      license {
        ...LicenseRow
      }
      userErrors {
        field
        message
      }
    }
  }
  ${LICENSE_FIELDS}
`;

const REVOKE_LICENSE = gql`
  mutation RevokeLicense($tenantId: ID!) {
    revokeLicense(tenantId: $tenantId) {
      license {
        id
        tenant {
          id
          name
          licensed
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Types + display helpers                                             */
/* ------------------------------------------------------------------ */
interface LicensesResult {
  licenses: License[];
}
interface TenantsResult {
  tenants: {
    edges: Array<{ node: Pick<Tenant, 'id' | 'name' | 'slug' | 'tier' | 'licensed'>; cursor: string }>;
    totalCount: number;
  };
}
interface GrantResult {
  grantLicense: { license: License | null; userErrors: UserError[] };
}
interface RevokeResult {
  revokeLicense: { license: { id: string; tenant: { id: string; name: string; licensed: boolean } } | null; userErrors: UserError[] };
}

const tierTone: Record<LicenseTier, PillTone> = {
  TRIAL: 'neutral',
  BUSINESS: 'high',
  ENTERPRISE: 'brand',
  CUSTOM: 'low',
};

const DAY = 24 * 60 * 60 * 1000;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
const fmtDate = (iso: string) => iso.slice(0, 10);

function statusCell(l: License) {
  if (l.status === 'EXPIRED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sev-critical-ink">
        <CircleX size={14} strokeWidth={2} aria-hidden="true" />
        Expired
      </span>
    );
  }
  if (l.status === 'EXPIRING') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sev-medium-ink">
        <Clock size={14} strokeWidth={2} aria-hidden="true" />
        Expiring
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-calm">
      <BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />
      Active
    </span>
  );
}

const thClass =
  'border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint';
const tdClass = 'border-b border-line-soft px-[14px] py-3 align-middle text-[13px] text-ink-2';

/* ------------------------------------------------------------------ */
/* Cache helpers                                                       */
/* ------------------------------------------------------------------ */
type Cache = import('@apollo/client').ApolloCache<unknown>;

function prependLicense(cache: Cache, license: License) {
  const ref = cache.writeFragment({ data: license, fragment: LICENSE_FIELDS, fragmentName: 'LicenseRow' });
  if (!ref) return;
  cache.modify({
    fields: {
      licenses(existing: unknown, { readField }) {
        const list = (Array.isArray(existing) ? existing : []) as readonly Reference[];
        if (list.some((r) => readField('id', r) === license.id)) return existing;
        return [ref, ...list];
      },
    },
  });
}

function removeLicense(cache: Cache, licenseId: string) {
  cache.modify({
    fields: {
      licenses(existing: unknown, { readField }) {
        const list = (Array.isArray(existing) ? existing : []) as readonly Reference[];
        return list.filter((r) => readField('id', r) !== licenseId);
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
type TenantLite = Pick<Tenant, 'id' | 'name' | 'slug' | 'tier' | 'licensed'>;

export default function Licensing() {
  const { toast } = useToast();
  const licensesQ = useQuery<LicensesResult>(LICENSES);
  const tenantsQ = useQuery<TenantsResult>(TENANTS_FOR_LICENSES);

  const [upgradeTarget, setUpgradeTarget] = useState<License | null>(null);
  const [upgradeTier, setUpgradeTier] = useState<LicenseTier>('BUSINESS');
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [granting, setGranting] = useState<string | null>(null); // `${tenantId}:${tier}`

  const licenses = useMemo(() => licensesQ.data?.licenses ?? [], [licensesQ.data]);
  const unlicensed = useMemo(
    () => (tenantsQ.data?.tenants.edges ?? []).map((e) => e.node).filter((t) => !t.licensed),
    [tenantsQ.data],
  );

  const inventory = useMemo(
    () =>
      [...licenses].sort((a, b) => {
        const wa = a.status === 'EXPIRED' ? 1 : 0;
        const wb = b.status === 'EXPIRED' ? 1 : 0;
        return wa - wb || a.expiresAt.localeCompare(b.expiresAt);
      }),
    [licenses],
  );

  const stats = useMemo(() => {
    const active = licenses.filter((l) => l.status !== 'EXPIRED').length;
    const expired = licenses.filter((l) => l.status === 'EXPIRED').length;
    const trial = licenses.filter((l) => l.tier === 'TRIAL').length;
    const enterprise = licenses.filter((l) => l.tier === 'ENTERPRISE').length;
    return { total: licenses.length, active, expired, trial, enterprise, unlicensed: unlicensed.length };
  }, [licenses, unlicensed]);

  const [grantLicense] = useMutation<GrantResult>(GRANT_LICENSE, {
    onError: (err) => {
      toast({
        title: 'Couldn’t issue the license',
        description: `mutation grantLicense failed — ${err.message}. No license was changed.`,
        tone: 'warning',
      });
    },
  });
  const [revokeLicense] = useMutation<RevokeResult>(REVOKE_LICENSE, {
    onError: (err) => {
      toast({
        title: 'Couldn’t revoke the license',
        description: `mutation revokeLicense failed — ${err.message}. The license stays active.`,
        tone: 'warning',
      });
    },
  });

  const grant = (tenant: TenantLite, tier: LicenseTier, source: 'upgrade' | 'grant') => {
    const key = `${tenant.id}:${tier}`;
    setGranting(key);
    const optimisticLicense: License = {
      __typename: 'License',
      id: `temp-grant-${tenant.id}`,
      tier,
      status: 'ACTIVE',
      key: 'ZSL-PENDING-ISSUE',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (tier === 'TRIAL' ? 30 : 365) * DAY).toISOString(),
      seatsUsed: 0,
      seatsTotal: tier === 'ENTERPRISE' ? 25 : tier === 'BUSINESS' ? 10 : 3,
      alertQuotaUsed: 0,
      alertQuotaTotal: tier === 'ENTERPRISE' ? 2_000_000 : tier === 'BUSINESS' ? 500_000 : 25_000,
      agentsUsed: 0,
      agentsTotal: tier === 'TRIAL' ? 3 : 15,
      tenant: { ...tenant, tier, licensed: true } as License['tenant'],
    } as License;
    void grantLicense({
      variables: { tenantId: tenant.id, tier },
      optimisticResponse: {
        grantLicense: { __typename: 'LicensePayload', license: optimisticLicense, userErrors: [] },
      } as GrantResult,
      update: (cache, result) => {
        const license = result.data?.grantLicense.license;
        if (license) prependLicense(cache, license);
      },
    })
      .then(({ data }) => {
        const payload = data?.grantLicense;
        if (!payload || payload.userErrors.length > 0 || !payload.license) {
          toast({
            title: 'License not issued',
            description: payload?.userErrors[0]?.message ?? 'The gateway rejected the request.',
            tone: 'warning',
          });
          return;
        }
        toast({
          title: source === 'upgrade' ? 'License upgraded' : 'License issued',
          description: `${tenant.name} is now on ${tier}. mutation grantLicense confirmed.`,
          tone: 'success',
        });
        if (source === 'upgrade') setUpgradeTarget(null);
      })
      .finally(() => setGranting(null));
  };

  const confirmRevoke = () => {
    const target = revokeTarget;
    if (!target) return;
    setRevokeTarget(null);
    void revokeLicense({
      variables: { tenantId: target.tenant.id },
      optimisticResponse: {
        revokeLicense: {
          __typename: 'LicensePayload',
          license: {
            __typename: 'License',
            id: target.id,
            tenant: { __typename: 'Tenant', id: target.tenant.id, name: target.tenant.name, licensed: false },
          },
          userErrors: [],
        },
      } as RevokeResult,
      update: (cache, result) => {
        const license = result.data?.revokeLicense.license;
        if (license) removeLicense(cache, license.id);
      },
    }).then(({ data }) => {
      const payload = data?.revokeLicense;
      if (!payload || payload.userErrors.length > 0 || !payload.license) {
        toast({
          title: 'License not revoked',
          description: payload?.userErrors[0]?.message ?? 'The gateway rejected the request.',
          tone: 'warning',
        });
        return;
      }
      toast({
        title: 'License revoked',
        description: `${target.tenant.name} lost its ${target.tier} license. You can undo this.`,
        action: {
          label: 'Undo',
          onClick: () => grant(target.tenant, target.tier, 'grant'),
        },
      });
    });
  };

  const licTrace =
    (licensesQ.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (licensesQ.error ? 'net-local' : undefined);

  /* Full failure */
  if (licensesQ.error && !licensesQ.data) {
    return (
      <ErrorCard
        title="The license inventory didn’t load"
        message={
          <>
            The query <span className="mono text-[12px]">licenses</span> failed. Enforcement keeps running on the
            gateway — only this view is affected.
          </>
        }
        traceId={licTrace}
        boundary="LicensingView"
        onRetry={() => void licensesQ.refetch()}
      />
    );
  }

  const loading = licensesQ.loading && !licensesQ.data;

  return (
    <>
      {/* status sentence */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">{stats.total} licenses on the books.</span>{' '}
          <span className="text-ink-3">
            {stats.unlicensed > 0
              ? `${stats.unlicensed} tenants are running without a license — ingest is paused for them.`
              : 'Every tenant is covered.'}
          </span>
        </p>
      </div>

      {/* Stat cards */}
      <section aria-label="License metrics">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold">License overview</h2>
          <GqlChip kind="query">query licenses</GqlChip>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard label="Total licenses" value={stats.total} sub="across all tenants" />
              <StatCard label="Active" value={stats.active} sub="enforcing now" subTone="calm" subDot />
              <StatCard label="Expired" value={stats.expired} sub="trials lapsed" />
              <StatCard label="Trial" value={stats.trial} sub="14-day evaluations" />
              <StatCard label="Enterprise" value={stats.enterprise} sub="top tier" />
              <StatCard label="Unlicensed" value={stats.unlicensed} sub="tenants paused" />
            </>
          )}
        </div>
      </section>

      {/* Active License Inventory */}
      <Card className="overflow-hidden" aria-labelledby="lic-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <h2 id="lic-h" className="font-display text-[15px] font-semibold">
              Active License Inventory
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Upgrade issues a new key; revoke is reversible with Undo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GqlChip kind="mutation" className="hidden md:inline-flex">
              mutation grantLicense · revokeLicense
            </GqlChip>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={8} columns={['w-36', 'w-20', 'w-20', 'w-24', 'w-20', 'w-20', 'w-16', 'w-28']} />
        ) : inventory.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={KeyRound}
              tone="neutral"
              title="No licenses yet"
              message="When a tenant is granted a license it appears here with its tier, quota, and expiry."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Tenant
                  </th>
                  <th scope="col" className={thClass}>
                    Tier
                  </th>
                  <th scope="col" className={thClass}>
                    Status
                  </th>
                  <th scope="col" className={thClass}>
                    Expiry
                  </th>
                  <th scope="col" className={thClass}>
                    Remaining
                  </th>
                  <th scope="col" className={thClass}>
                    Alerts
                  </th>
                  <th scope="col" className={thClass}>
                    Agents
                  </th>
                  <th scope="col" className={cn(thClass, 'text-right')}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((l) => {
                  const left = daysLeft(l.expiresAt);
                  const expired = l.status === 'EXPIRED' || left <= 0;
                  return (
                    <tr key={l.id} className="last:[&>td]:border-b-0">
                      <td className={tdClass}>
                        <p className="text-[13px] font-medium text-ink">{l.tenant.name}</p>
                        <p className="mono text-[11px] text-ink-3">{l.key}</p>
                      </td>
                      <td className={tdClass}>
                        <StatusPill tone={tierTone[l.tier]}>{l.tier}</StatusPill>
                      </td>
                      <td className={tdClass}>{statusCell(l)}</td>
                      <td className={cn(tdClass, 'mono text-[12px]')}>{fmtDate(l.expiresAt)}</td>
                      <td className={cn(tdClass, 'mono text-[12px]', expired && 'text-sev-critical-ink')}>
                        {expired ? 'Expired' : `${left} days`}
                      </td>
                      <td className={cn(tdClass, 'mono text-[12px]')}>{formatNumber(l.alertQuotaUsed)}</td>
                      <td className={cn(tdClass, 'mono text-[12px]')}>
                        {l.agentsUsed}–{l.agentsTotal}
                      </td>
                      <td className={cn(tdClass, 'whitespace-nowrap text-right')}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setUpgradeTier(l.tier === 'ENTERPRISE' ? 'ENTERPRISE' : 'BUSINESS');
                            setUpgradeTarget(l);
                          }}
                        >
                          Upgrade
                        </button>
                        {!expired && (
                          <button
                            type="button"
                            className="btn btn-sm ml-1 border border-sev-critical bg-white text-sev-critical-ink hover:bg-sev-critical-tint"
                            onClick={() => setRevokeTarget(l)}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Unlicensed tenants */}
      <Card className="overflow-hidden" aria-labelledby="unl-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <h2 id="unl-h" className="font-display text-[15px] font-semibold">
              Unlicensed Tenants
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Granting a license moves the tenant into the inventory instantly.
            </p>
          </div>
          <GqlChip kind="query">query tenants(first: 50)</GqlChip>
        </div>
        {tenantsQ.loading && !tenantsQ.data ? (
          <TableSkeleton rows={3} columns={['w-40', 'w-24', 'w-56']} />
        ) : tenantsQ.error && !tenantsQ.data ? (
          <div className="px-5 pb-5">
            <ErrorCard
              title="Unlicensed tenants didn’t load"
              message={
                <>
                  The query <span className="mono text-[12px]">tenants(first: 50)</span> failed. Licenses already
                  issued are unaffected.
                </>
              }
              boundary="UnlicensedTenants"
              onRetry={() => void tenantsQ.refetch()}
            />
          </div>
        ) : unlicensed.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={BadgeCheck}
              title="Nothing needs you right now"
              message="Every tenant has a license. New trials show up here if their license lapses."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Tenant
                  </th>
                  <th scope="col" className={thClass}>
                    License
                  </th>
                  <th scope="col" className={cn(thClass, 'text-right')}>
                    Grant license
                  </th>
                </tr>
              </thead>
              <tbody>
                {unlicensed.map((t) => (
                  <tr key={t.id} className="last:[&>td]:border-b-0">
                    <td className={tdClass}>
                      <p className="text-[13px] font-medium text-ink">{t.name}</p>
                      <p className="mono text-[11px] text-ink-3">{t.slug}</p>
                    </td>
                    <td className={tdClass}>
                      <StatusPill tone="critical">NO LICENSE</StatusPill>
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap text-right')}>
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <SpinnerButton
                          size="sm"
                          variant="secondary"
                          loading={granting === `${t.id}:TRIAL`}
                          spinnerLabel="Granting…"
                          onClick={() => grant(t, 'TRIAL', 'grant')}
                        >
                          Trial
                        </SpinnerButton>
                        <SpinnerButton
                          size="sm"
                          variant="primary"
                          loading={granting === `${t.id}:ENTERPRISE`}
                          spinnerLabel="Granting…"
                          onClick={() => grant(t, 'ENTERPRISE', 'grant')}
                        >
                          Enterprise
                        </SpinnerButton>
                        <SpinnerButton
                          size="sm"
                          variant="secondary"
                          loading={granting === `${t.id}:BUSINESS`}
                          spinnerLabel="Granting…"
                          onClick={() => grant(t, 'BUSINESS', 'grant')}
                        >
                          Business
                        </SpinnerButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upgrade tier dialog */}
      <FleetModal
        open={upgradeTarget != null}
        onClose={() => setUpgradeTarget(null)}
        title={upgradeTarget ? `Upgrade ${upgradeTarget.tenant.name}` : 'Upgrade license'}
        subline="Issues a new key at the chosen tier, effective immediately."
        chip={<GqlChip kind="mutation">mutation grantLicense</GqlChip>}
        maxWidth={440}
      >
        <form
          className="space-y-4 px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (upgradeTarget) grant(upgradeTarget.tenant, upgradeTier, 'upgrade');
          }}
        >
          <div>
            <label htmlFor="up-tier" className={labelClass}>
              New tier
            </label>
            <select
              id="up-tier"
              className={inputClass}
              value={upgradeTier}
              onChange={(e) => setUpgradeTier(e.target.value as LicenseTier)}
            >
              <option value="TRIAL">TRIAL · 14 days</option>
              <option value="BUSINESS">BUSINESS · 500k alerts</option>
              <option value="ENTERPRISE">ENTERPRISE · 2M alerts</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <SpinnerButton
              type="submit"
              variant="primary"
              loading={granting != null && upgradeTarget != null && granting === `${upgradeTarget.tenant.id}:${upgradeTier}`}
              spinnerLabel="Upgrading…"
            >
              Issue license
            </SpinnerButton>
            <button type="button" className="btn btn-ghost" onClick={() => setUpgradeTarget(null)}>
              Cancel
            </button>
          </div>
        </form>
      </FleetModal>

      {/* Revoke confirm dialog */}
      <FleetModal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title={revokeTarget ? `Revoke ${revokeTarget.tenant.name}’s license?` : 'Revoke license?'}
        subline="Ingest pauses for this tenant. You can undo right after."
        chip={<GqlChip kind="mutation">mutation revokeLicense</GqlChip>}
        maxWidth={440}
      >
        <div className="space-y-4 px-6 py-5">
          <p className="text-[13px] leading-relaxed text-ink-2">
            The {revokeTarget?.tier} license <span className="mono text-[12px]">{revokeTarget?.key}</span> will be
            revoked. Historical alerts stay available; new events stop until a new license is issued.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              className="btn border border-sev-critical bg-sev-critical text-white hover:bg-sev-critical-ink"
              onClick={confirmRevoke}
            >
              Revoke license
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRevokeTarget(null)}>
              Keep license
            </button>
          </div>
        </div>
      </FleetModal>

      <footer className="pb-24" />
    </>
  );
}
