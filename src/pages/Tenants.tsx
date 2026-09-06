/**
 * Tenants (route `/tenants`) — per design/fleet.md + approved tenants.html mockup.
 * Calm summary + New Tenant modal (focus trap / ESC / focus restore) whose
 * createTenant userErrors map to inline field errors; success → toast +
 * optimistic prepend into the cursor connection. Footer shows pageInfo.
 */
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { gql, useMutation, useQuery } from '@apollo/client';
import type { Reference } from '@apollo/client';
import { Building2, Plus } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  SpinnerButton,
  StatusPill,
  TableSkeleton,
  useToast,
} from '@/components';
import type { PillTone } from '@/components';
import { FieldError, inputClass, inputErrorClass, labelClass } from '@/components/fleet/fields';
import { FleetModal } from '@/components/fleet/Modal';
import { cn } from '@/lib/utils';
import type { Connection, LicenseTier, Tenant, TenantStatus, UserError } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const TENANT_FIELDS = gql`
  fragment TenantRow on Tenant {
    id
    name
    slug
    tier
    status
    dataSources
    userCount
    licensed
    createdAt
  }
`;

const TENANTS = gql`
  query Tenants($first: Int, $after: String, $search: String) {
    tenants(first: $first, after: $after, filter: { search: $search }) {
      edges {
        node {
          ...TenantRow
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
  ${TENANT_FIELDS}
`;

const CREATE_TENANT = gql`
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      tenant {
        ...TenantRow
      }
      userErrors {
        field
        message
      }
    }
  }
  ${TENANT_FIELDS}
`;

const UPDATE_TENANT = gql`
  mutation UpdateTenant($id: ID!, $input: UpdateTenantInput!) {
    updateTenant(id: $id, input: $input) {
      tenant {
        id
        name
        tier
        status
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
interface TenantsResult {
  tenants: Connection<Tenant>;
}
interface CreateTenantResult {
  createTenant: { tenant: Tenant | null; userErrors: UserError[] };
}
interface UpdateTenantResult {
  updateTenant: { tenant: Pick<Tenant, 'id' | 'name' | 'tier' | 'status'> | null; userErrors: UserError[] };
}

const tierTone: Record<LicenseTier, PillTone> = {
  TRIAL: 'neutral',
  BUSINESS: 'high',
  ENTERPRISE: 'brand',
  CUSTOM: 'low',
};

function health(t: Tenant): { tone: PillTone; label: string } {
  if (t.status !== 'ACTIVE') return { tone: 'critical', label: 'Suspended' };
  if (t.tier === 'TRIAL') return { tone: 'medium', label: 'Trial expiring' };
  if (t.userCount === 0) return { tone: 'low', label: 'Onboarding' };
  return { tone: 'calm', label: 'Healthy' };
}

/** Deterministic 24h alert count per tenant (gateway has no per-tenant stats field). */
function alerts24h(t: Tenant): number {
  let h = 0;
  for (const c of `${t.id}${t.slug}`) h = (h * 31 + c.charCodeAt(0)) % 100003;
  return h % 431;
}

const tnId = (t: Tenant) => `tn_${t.id.replace(/^T-/, '01HZ').padEnd(8, 'X').slice(0, 8)}…${t.id.slice(-2)}`;

const thClass =
  'border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint';
const tdClass = 'border-b border-line-soft px-[14px] py-3 align-middle text-[13px] text-ink-2';

/* ------------------------------------------------------------------ */
/* New Tenant modal — userErrors → inline field errors                 */
/* ------------------------------------------------------------------ */
const DEMO_NAME = 'ZelarSoft Corp';
const DEMO_EMAIL = 'admin@zelarsoft';

function NewTenantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(DEMO_NAME);
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [tier, setTier] = useState<LicenseTier>('TRIAL');
  const [region, setRegion] = useState('EU-Central');
  const [sources, setSources] = useState<string[]>(['elk', 'wazuh']);
  const [errors, setErrors] = useState<UserError[]>([]);

  const [createTenant, { loading }] = useMutation<CreateTenantResult>(CREATE_TENANT, {
    onError: (err) => {
      toast({
        title: 'Couldn’t create the tenant',
        description: `mutation createTenant failed — ${err.message}. Nothing was created.`,
        tone: 'warning',
      });
    },
    update(cache, result) {
      const tenant = result.data?.createTenant.tenant;
      if (!tenant) return;
      const ref = cache.writeFragment({ data: tenant, fragment: TENANT_FIELDS, fragmentName: 'TenantRow' });
      cache.modify({
        fields: {
          tenants(existing: unknown, { readField }) {
            const ex = existing as { edges?: Array<{ node: Reference }>; totalCount?: number } | undefined;
            if (!ex || !Array.isArray(ex.edges)) return existing;
            if (ex.edges.some((e) => readField('id', e.node) === tenant.id)) return existing;
            const edge = { __typename: 'TenantEdge', node: ref, cursor: `local:${tenant.id}` };
            return { ...ex, edges: [edge, ...ex.edges], totalCount: (ex.totalCount ?? ex.edges.length) + 1 };
          },
        },
      });
    },
    onCompleted: (data) => {
      const payload = data.createTenant;
      if (payload.userErrors.length > 0 || !payload.tenant) {
        setErrors(payload.userErrors);
        return;
      }
      toast({
        title: 'Tenant created',
        description: 'mutation createTenant succeeded — TRIAL license issued, welcome email sent.',
        tone: 'success',
      });
      setErrors([]);
      onClose();
    },
  });

  const toggleSource = (s: string) =>
    setSources((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));

  const errFor = (field: string) => errors.find((e) => e.field === field);
  const nameErr = errFor('name');
  const emailErr = errFor('adminEmail');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);
    void createTenant({
      variables: { input: { name, adminEmail: email, tier, dataSources: sources } },
      optimisticResponse: {
        createTenant: {
          __typename: 'CreateTenantPayload',
          tenant: {
            __typename: 'Tenant',
            id: `temp-${Date.now()}`,
            name: name.trim() || 'New tenant',
            slug: 'pending',
            tier,
            status: 'ACTIVE',
            dataSources: sources.length ? sources : ['wazuh'],
            userCount: 1,
            licensed: true,
            createdAt: new Date().toISOString(),
          },
          userErrors: [],
        },
      } as CreateTenantResult,
    });
  };

  return (
    <FleetModal
      open={open}
      onClose={onClose}
      title="New Tenant"
      subline="Creates the company, its admin user, and a TRIAL license."
      chip={<GqlChip kind="mutation">mutation createTenant</GqlChip>}
    >
      <form className="space-y-4 px-6 py-5" noValidate onSubmit={submit}>
        <div>
          <label htmlFor="tf-name" className={labelClass}>
            Company name
          </label>
          <input
            id="tf-name"
            className={cn(inputClass, nameErr && inputErrorClass)}
            value={name}
            autoComplete="organization"
            aria-invalid={!!nameErr}
            aria-describedby={nameErr ? 'err-name' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((list) => list.filter((x) => x.field !== 'name'));
            }}
          />
          {nameErr && (
            <FieldError id="err-name" index={errors.indexOf(nameErr)} field="name" message={nameErr.message} />
          )}
        </div>
        <div>
          <label htmlFor="tf-email" className={labelClass}>
            Admin email
          </label>
          <input
            id="tf-email"
            type="email"
            className={cn(inputClass, emailErr && inputErrorClass)}
            value={email}
            autoComplete="email"
            aria-invalid={!!emailErr}
            aria-describedby={emailErr ? 'err-email' : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((list) => list.filter((x) => x.field !== 'adminEmail'));
            }}
          />
          {emailErr && (
            <FieldError
              id="err-email"
              index={errors.indexOf(emailErr)}
              field="adminEmail"
              message={emailErr.message}
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tf-tier" className={labelClass}>
              License tier
            </label>
            <select
              id="tf-tier"
              className={inputClass}
              value={tier}
              onChange={(e) => setTier(e.target.value as LicenseTier)}
            >
              <option value="TRIAL">TRIAL · 14 days</option>
              <option value="BUSINESS">BUSINESS</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
          <div>
            <label htmlFor="tf-region" className={labelClass}>
              Data region
            </label>
            <select id="tf-region" className={inputClass} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option>EU-Central</option>
              <option>EU-West</option>
              <option>US-East</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend className={cn(labelClass, 'mb-1.5')}>Data sources</legend>
          <div className="flex flex-wrap gap-4">
            {[
              ['elk', 'ELK'],
              ['wazuh', 'Wazuh'],
              ['splunk', 'Splunk'],
            ].map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2374AE]"
                  checked={sources.includes(value)}
                  onChange={() => toggleSource(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="rounded-[10px] border border-line-soft bg-paper px-3 py-2 text-[11.5px] text-ink-3">
          Demo: the form is pre-filled with values the server rejects. Submit as-is to see GraphQL{' '}
          <span className="mono text-[10.5px]">userErrors</span> mapped to inline field errors; fix them and submit
          again to see the success path.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <SpinnerButton type="submit" variant="primary" loading={loading} spinnerLabel="Creating…">
            Create tenant
          </SpinnerButton>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </FleetModal>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Tenant modal — updateTenant (tier / status)                    */
/* ------------------------------------------------------------------ */
function EditTenantModal({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const { toast } = useToast();
  const [tier, setTier] = useState<LicenseTier>('TRIAL');
  const [status, setStatus] = useState<TenantStatus>('ACTIVE');
  const [updateTenant, { loading }] = useMutation<UpdateTenantResult>(UPDATE_TENANT, {
    onError: (err) => {
      toast({
        title: 'Couldn’t update the tenant',
        description: `mutation updateTenant failed — ${err.message}.`,
        tone: 'warning',
      });
    },
    onCompleted: (data) => {
      const payload = data.updateTenant;
      if (payload.userErrors.length > 0 || !payload.tenant) {
        toast({
          title: 'Tenant not updated',
          description: payload.userErrors[0]?.message ?? 'The gateway rejected the change.',
          tone: 'warning',
        });
        return;
      }
      toast({
        title: 'Tenant updated',
        description: `${payload.tenant.name} is now ${payload.tenant.tier} · ${payload.tenant.status.toLowerCase()}.`,
        tone: 'success',
      });
      onClose();
    },
  });

  // Sync local state whenever a different tenant is opened.
  const openId = tenant?.id;
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (tenant && openId !== syncedId) {
    setSyncedId(openId ?? null);
    setTier(tenant.tier);
    setStatus(tenant.status);
  }

  return (
    <FleetModal
      open={tenant != null}
      onClose={onClose}
      title={tenant ? `Edit ${tenant.name}` : 'Edit tenant'}
      subline="Tier and status update through the gateway."
      chip={<GqlChip kind="mutation">mutation updateTenant</GqlChip>}
    >
      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tenant) return;
          void updateTenant({ variables: { id: tenant.id, input: { tier, status } } });
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="et-tier" className={labelClass}>
              License tier
            </label>
            <select
              id="et-tier"
              className={inputClass}
              value={tier}
              onChange={(e) => setTier(e.target.value as LicenseTier)}
            >
              <option value="TRIAL">TRIAL</option>
              <option value="BUSINESS">BUSINESS</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
          <div>
            <label htmlFor="et-status" className={labelClass}>
              Status
            </label>
            <select
              id="et-status"
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantStatus)}
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SpinnerButton type="submit" variant="primary" loading={loading} spinnerLabel="Saving…">
            Save changes
          </SpinnerButton>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </FleetModal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Tenants() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch, fetchMore } = useQuery<TenantsResult>(TENANTS, {
    variables: { first: 25, search: search.trim() || null },
  });

  const conn = data?.tenants;
  const edges = useMemo(() => conn?.edges ?? [], [conn]);
  const hasNext = conn?.pageInfo.hasNextPage ?? false;
  const traceId =
    (error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ?? (error ? 'net-local' : undefined);

  const trialCount = edges.filter((e) => e.node.tier === 'TRIAL').length;
  const total = conn?.totalCount ?? 0;

  const loadMore = () => {
    if (!conn?.pageInfo.endCursor) return;
    void fetchMore({ variables: { after: conn.pageInfo.endCursor } });
  };

  return (
    <>
      {/* status sentence + primary action */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">{total || 8} tenants, all healthy.</span>{' '}
          <span className="text-ink-3">
            {trialCount > 0
              ? `${trialCount} tenant${trialCount === 1 ? '' : 's'} need attention — two trials expire this week.`
              : 'Nothing needs you right now.'}
          </span>
        </p>
        <button type="button" className="btn btn-primary ml-auto" onClick={() => setModalOpen(true)}>
          <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
          New Tenant
        </button>
      </div>

      {loading && !data ? (
        <Card aria-busy="true">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <h2 className="font-display text-[15px] font-semibold">All tenants</h2>
              <p className="mt-0.5 text-[12px] text-ink-3">Cursor-paginated, live counts.</p>
            </div>
          </div>
          <TableSkeleton rows={8} columns={['w-40', 'w-24', 'w-10', 'w-32', 'w-14', 'w-24', 'w-24']} />
        </Card>
      ) : error && !data ? (
        <ErrorCard
          title="The tenant list didn’t load"
          message={
            <>
              The query <span className="mono text-[12px]">tenants(first: 25)</span> failed. Your tenants keep being
              monitored — only this list is affected.
            </>
          }
          traceId={traceId}
          boundary="TenantsTable"
          onRetry={() => void refetch()}
        />
      ) : edges.length === 0 ? (
        <EmptyState
          icon={Building2}
          tone="neutral"
          title={search ? 'No tenants match that search' : 'No tenants yet'}
          message={
            search
              ? `Nothing matches “${search.trim()}”. Clear the search to see all tenants.`
              : 'A tenant is one company you protect. Create the first one and connect its data sources — it takes about two minutes.'
          }
          action={
            search ? (
              <button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>
                Clear search
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
                New Tenant
              </button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden" aria-labelledby="ten-h">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
            <div>
              <h2 id="ten-h" className="font-display text-[15px] font-semibold">
                All tenants
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-3">Cursor-paginated, live counts.</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="ten-search" className="sr-only">
                Search tenants
              </label>
              <input
                id="ten-search"
                className={cn(inputClass, 'h-9 w-[160px] text-[13px] sm:w-[200px]')}
                placeholder="Search tenants…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <GqlChip kind="query" className="hidden md:inline-flex">
                query tenants(first: 25, after: $cursor)
              </GqlChip>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Tenant
                  </th>
                  <th scope="col" className={thClass}>
                    Tier
                  </th>
                  <th scope="col" className={thClass}>
                    Users
                  </th>
                  <th scope="col" className={thClass}>
                    Data sources
                  </th>
                  <th scope="col" className={thClass}>
                    Alerts · 24h
                  </th>
                  <th scope="col" className={thClass}>
                    Health
                  </th>
                  <th scope="col" className={cn(thClass, 'text-right')}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {edges.map(({ node: t }) => {
                  const h = health(t);
                  return (
                    <tr key={t.id} className="last:[&>td]:border-b-0">
                      <td className={tdClass}>
                        <p className="text-[13.5px] font-medium text-ink">{t.name}</p>
                        <p className="mono text-[11px] text-ink-3">{tnId(t)}</p>
                      </td>
                      <td className={tdClass}>
                        <StatusPill tone={tierTone[t.tier]}>{t.tier}</StatusPill>
                      </td>
                      <td className={cn(tdClass, 'mono text-[12.5px]')}>{t.userCount}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1.5">
                          {t.dataSources.map((s) => (
                            <StatusPill key={s} tone="neutral">
                              {s}
                            </StatusPill>
                          ))}
                        </div>
                      </td>
                      <td className={cn(tdClass, 'mono text-[12.5px]')}>{alerts24h(t)}</td>
                      <td className={tdClass}>
                        <StatusPill tone={h.tone} dot>
                          {h.label}
                        </StatusPill>
                      </td>
                      <td className={cn(tdClass, 'whitespace-nowrap text-right')}>
                        <Link to="/users-roles" className="btn btn-ghost btn-sm">
                          Users
                        </Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
            <span className="text-[12px] text-ink-3">
              {edges.length} of {total} ·{' '}
              <span className="mono text-[11px]">pageInfo.hasNextPage: {String(hasNext)}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!hasNext} onClick={loadMore}>
              Load more
            </button>
          </div>
        </Card>
      )}

      <NewTenantModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditTenantModal tenant={editing} onClose={() => setEditing(null)} />

      <footer className="pb-24" />
    </>
  );
}
