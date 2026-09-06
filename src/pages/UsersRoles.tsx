/**
 * Users & Roles (route `/users-roles`) — per design/fleet.md + approved
 * users-roles.html mockup.
 * Users table: role change via dropdown → mutation updateUserRole with an
 * optimisticResponse (pill flips instantly); on fault the cache rolls back and
 * an error toast explains the revert. Roles permission matrix via query roles.
 */
import { useMemo, useRef } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { Check, Lock, UsersRound } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorCard,
  GqlChip,
  StatusPill,
  TableSkeleton,
  useToast,
} from '@/components';
import type { PillTone } from '@/components';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Connection, Role, User, UserError } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const USERS = gql`
  query Users($first: Int, $after: String) {
    users(first: $first, after: $after) {
      edges {
        node {
          id
          name
          email
          initials
          status
          protected
          lastSignIn
          tenant {
            id
            name
          }
          role {
            id
            name
            level
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

const ROLES = gql`
  query Roles {
    roles(tenantId: null) {
      id
      name
      level
      protected
      permissions
      userCount
    }
  }
`;

const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      user {
        id
        role {
          id
          name
          level
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
interface UsersResult {
  users: Connection<User>;
}
interface RolesResult {
  roles: Role[];
}
interface UpdateUserRoleResult {
  updateUserRole: {
    user: { id: string; role: Pick<Role, 'id' | 'name' | 'level'> } | null;
    userErrors: UserError[];
  };
}

const roleTone = (name: string): PillTone => {
  if (/platform admin/i.test(name)) return 'critical';
  if (/admin/i.test(name)) return 'brand';
  if (/soc|operator/i.test(name)) return 'high';
  if (/analyst|hunter|manager/i.test(name)) return 'brand';
  return 'neutral';
};

const avatarTint = (i: number) =>
  [
    'bg-brand-tint text-brand-ink',
    'bg-calm-tint text-calm',
    'bg-sev-medium-tint text-sev-medium-ink',
    'bg-sev-low-tint text-sev-low-ink',
    'bg-sev-high-tint text-sev-high-ink',
  ][i % 5];

/** Permission matrix columns — check = role.permissions grants it ('*' = all). */
const MATRIX_COLUMNS: Array<{ label: string; grants: (p: string[]) => boolean }> = [
  { label: 'View alerts', grants: (p) => p.includes('*') || p.some((x) => x.startsWith('alerts')) },
  { label: 'Act on alerts', grants: (p) => p.includes('*') || p.includes('alerts:act') || p.includes('alerts:ack') },
  { label: 'Edit policies', grants: (p) => p.includes('*') || p.some((x) => x.startsWith('policies')) },
  { label: 'Manage users', grants: (p) => p.includes('*') || p.includes('users:manage') },
  { label: 'Manage tenants', grants: (p) => p.includes('*') || p.includes('tenant:manage') },
  { label: 'Audit access', grants: (p) => p.includes('*') || p.includes('audit:read') || p.includes('reports:read') },
];

const thClass =
  'border-b border-line-soft bg-[#FCFBF7] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint';
const tdClass = 'border-b border-line-soft px-[14px] py-3 align-middle text-[13px] text-ink-2';

/* ------------------------------------------------------------------ */
/* Role select with optimistic update + revert                         */
/* ------------------------------------------------------------------ */
function RoleSelect({ user, roles }: { user: User; roles: Role[] }) {
  const { toast } = useToast();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [updateUserRole, { loading }] = useMutation<UpdateUserRoleResult>(UPDATE_USER_ROLE, {
    onError: (err) => {
      // Apollo rolled the optimistic role back automatically.
      toast({
        title: 'Couldn’t change role — reverted',
        description: `mutation updateUserRole failed — ${err.message}. ${user.name} stays ${user.role.name}.`,
        tone: 'warning',
      });
    },
    onCompleted: (data) => {
      const payload = data.updateUserRole;
      if (payload.userErrors.length > 0 || !payload.user) {
        toast({
          title: 'Couldn’t change role — reverted',
          description: payload.userErrors[0]?.message ?? 'The gateway rejected the role change.',
          tone: 'warning',
        });
        return;
      }
      toast({
        title: 'Role updated',
        description: `${user.name} is now ${payload.user.role.name}. mutation updateUserRole confirmed.`,
        tone: 'success',
      });
    },
  });

  const changeRole = (roleName: string) => {
    const role = roles.find((r) => r.name === roleName);
    if (!role || role.id === user.role.id) return;
    void updateUserRole({
      variables: { userId: user.id, role: role.name },
      optimisticResponse: {
        updateUserRole: {
          __typename: 'UpdateUserPayload',
          user: {
            __typename: 'User',
            id: user.id,
            role: { __typename: 'Role', id: role.id, name: role.name, level: role.level },
          },
          userErrors: [],
        },
      } as UpdateUserRoleResult,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <StatusPill tone={roleTone(user.role.name)} className="hidden xl:inline-flex">
        {user.role.name}
      </StatusPill>
      <label htmlFor={`role-${user.id}`} className="sr-only">
        Role for {user.name}
      </label>
      <select
        id={`role-${user.id}`}
        ref={selectRef}
        className="h-[30px] rounded-lg border border-line bg-white px-2 text-[12px] font-medium text-ink"
        value={user.role.name}
        disabled={loading}
        aria-busy={loading || undefined}
        onChange={(e) => changeRole(e.target.value)}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
      <span className="sr-only" aria-live="polite">
        {loading ? `Saving role for ${user.name}…` : ''}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function UsersRoles() {
  const usersQ = useQuery<UsersResult>(USERS, { variables: { first: 25 } });
  const rolesQ = useQuery<RolesResult>(ROLES);

  const usersConn = usersQ.data?.users;
  const userEdges = useMemo(() => usersConn?.edges ?? [], [usersConn]);
  const roles = useMemo(() => rolesQ.data?.roles ?? [], [rolesQ.data]);
  const protectedCount = userEdges.filter((e) => e.node.protected).length;
  const hasNext = usersConn?.pageInfo.hasNextPage ?? false;

  const usersTrace =
    (usersQ.error?.graphQLErrors?.[0]?.extensions?.traceId as string | undefined) ??
    (usersQ.error ? 'net-local' : undefined);

  const loadMore = () => {
    if (!usersConn?.pageInfo.endCursor) return;
    void usersQ.fetchMore({ variables: { after: usersConn.pageInfo.endCursor } });
  };

  /* Full failure of the primary region */
  if (usersQ.error && !usersQ.data) {
    return (
      <ErrorCard
        title="Users and roles didn’t load"
        message={
          <>
            The query <span className="mono text-[12px]">users(first: 25)</span> failed. Nobody’s access has changed —
            only this view is affected.
          </>
        }
        traceId={usersTrace}
        boundary="UsersRolesView"
        onRetry={() => void usersQ.refetch()}
      />
    );
  }

  return (
    <>
      {/* status sentence */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">
            {usersConn?.totalCount ?? 12} users, {roles.length || 8} roles.
          </span>{' '}
          <span className="text-ink-3">
            {protectedCount > 0
              ? `${protectedCount === 2 ? 'Two' : protectedCount} system users are protected and can’t be edited.`
              : 'Role changes apply instantly and confirm through the gateway.'}
          </span>
        </p>
      </div>

      {/* Users table */}
      <Card className="overflow-hidden" aria-labelledby="usr-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <h2 id="usr-h" className="font-display text-[15px] font-semibold">
              Users
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Role changes apply optimistically — if the server says no, the UI reverts and tells you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GqlChip kind="query" className="hidden md:inline-flex">
              query users(first: 25, after: $cursor)
            </GqlChip>
            <GqlChip kind="mutation">mutation updateUserRole</GqlChip>
          </div>
        </div>
        {usersQ.loading && !usersQ.data ? (
          <TableSkeleton rows={8} columns={['w-44', 'w-28', 'w-36', 'w-20', 'w-20', 'w-20']} />
        ) : userEdges.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={UsersRound}
              tone="neutral"
              title="No users yet"
              message="When someone is invited to a tenant, they’ll show up here with their role and sign-in status."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      User
                    </th>
                    <th scope="col" className={thClass}>
                      Tenant
                    </th>
                    <th scope="col" className={thClass}>
                      Role
                    </th>
                    <th scope="col" className={thClass}>
                      Status
                    </th>
                    <th scope="col" className={thClass}>
                      Last active
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Access
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userEdges.map(({ node: u }, i) => (
                    <tr key={u.id} className="last:[&>td]:border-b-0">
                      <td className={tdClass}>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'font-display grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                              avatarTint(i),
                            )}
                            aria-hidden="true"
                          >
                            {u.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {u.name}
                              {u.email.endsWith('@zelarsoar.internal') && (
                                <StatusPill tone="neutral" className="ml-1.5">
                                  system
                                </StatusPill>
                              )}
                            </p>
                            <p className="mono truncate text-[11px] text-ink-3">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn(tdClass, 'text-[12.5px]')}>{u.tenant.name}</td>
                      <td className={tdClass}>
                        {u.protected ? (
                          <StatusPill tone={roleTone(u.role.name)}>{u.role.name}</StatusPill>
                        ) : (
                          <RoleSelect user={u} roles={roles} />
                        )}
                      </td>
                      <td className={tdClass}>
                        <StatusPill tone={u.status === 'Active' ? 'calm' : 'low'} dot>
                          {u.status.toUpperCase()}
                        </StatusPill>
                      </td>
                      <td className={cn(tdClass, 'mono text-[11.5px] text-ink-3')}>
                        {u.lastSignIn ? timeAgo(u.lastSignIn) : '—'}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        {u.protected ? (
                          <StatusPill tone="neutral">
                            <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
                            Protected
                          </StatusPill>
                        ) : (
                          <span className="text-[12px] text-ink-3">Editable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
              <span className="text-[12px] text-ink-3">
                {userEdges.length} of {usersConn?.totalCount ?? userEdges.length} ·{' '}
                <span className="mono text-[11px]">pageInfo.hasNextPage: {String(hasNext)}</span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!hasNext} onClick={loadMore}>
                Load more
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Roles permission matrix */}
      <Card className="overflow-hidden" aria-labelledby="rol-h">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <h2 id="rol-h" className="font-display text-[15px] font-semibold">
              Roles &amp; permissions
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Higher level wins. System roles (shaded) can’t be edited or deleted.
            </p>
          </div>
          <GqlChip kind="query">query roles(tenantId: null)</GqlChip>
        </div>
        {rolesQ.loading && !rolesQ.data ? (
          <TableSkeleton rows={8} columns={['w-40', 'w-12', 'w-16', 'w-16', 'w-16', 'w-16', 'w-16', 'w-16']} />
        ) : rolesQ.error && !rolesQ.data ? (
          <div className="px-5 pb-5">
            <ErrorCard
              title="The role matrix didn’t load"
              message={
                <>
                  The query <span className="mono text-[12px]">roles(tenantId: null)</span> failed. User roles keep
                  working — only this matrix is affected.
                </>
              }
              boundary="RolesMatrix"
              onRetry={() => void rolesQ.refetch()}
            />
          </div>
        ) : roles.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={Lock}
              tone="neutral"
              title="No roles defined"
              message="Roles appear here once the first tenant defines its access model."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Role
                  </th>
                  <th scope="col" className={thClass}>
                    Level
                  </th>
                  {MATRIX_COLUMNS.map((c) => (
                    <th key={c.label} scope="col" className={thClass}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className={cn('last:[&>td]:border-b-0', r.protected && 'bg-[#FCFBF7]')}>
                    <td className={tdClass}>
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        {r.protected && <Lock size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />}
                        {r.name}
                      </p>
                      <p className="text-[11px] text-ink-3">
                        {r.protected ? 'system · protected' : `${r.userCount} user${r.userCount === 1 ? '' : 's'}`}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <span className="mono text-[12px] font-semibold">{r.level}</span>
                    </td>
                    {MATRIX_COLUMNS.map((c) => (
                      <td key={c.label} className={tdClass}>
                        {c.grants(r.permissions) ? (
                          <Check size={14} strokeWidth={2.4} className="text-calm" aria-label="allowed" role="img" />
                        ) : (
                          <span className="text-ink-3" aria-label="not allowed">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <footer className="pb-24" />
    </>
  );
}
