/**
 * Executable schema for the embedded ZelarSOAR gateway (design.md §4).
 * Resolvers run against the in-memory store in data.ts; mutations mutate it.
 */
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './typeDefs';
import {
  GEO_FAIL_ALERT_ID,
  alerts,
  auditEvents,
  blockedIps,
  firewallIntegrations,
  incidents,
  licenses,
  roleById,
  roles,
  soarPolicy,
  telemetrySeed,
  tenantById,
  tenants,
  threatIntel,
  users,
} from './data';
import { liveStream } from './live';
import type {
  Alert,
  AlertVerdict,
  AuditEvent,
  BlockedIp,
  Connection,
  Incident,
  IncidentStatus,
  License,
  LicenseTier,
  Severity,
  Tenant,
  User,
} from './types';

/** Per-request context passed by GatewayLink (fault demos). */
export interface GatewayContext {
  forcePartial?: boolean;
}

/* ------------------------------------------------------------------ */
/* Relay cursor helpers — cursor is an opaque base64 index             */
/* ------------------------------------------------------------------ */
function toCursor(index: number): string {
  return btoa(`cursor:${index}`);
}
function fromCursor(cursor: string | null | undefined): number {
  if (!cursor) return -1;
  try {
    const raw = atob(cursor);
    const idx = Number(raw.replace('cursor:', ''));
    return Number.isFinite(idx) ? idx : -1;
  } catch {
    return -1;
  }
}
function paginate<T>(items: T[], first?: number | null, after?: string | null): Connection<T> {
  const start = fromCursor(after) + 1;
  const take = first && first > 0 ? first : 25;
  const slice = items.slice(start, start + take);
  const endIndex = start + slice.length - 1;
  return {
    edges: slice.map((node, i) => ({ node, cursor: toCursor(start + i) })),
    pageInfo: { hasNextPage: endIndex < items.length - 1, endCursor: slice.length ? toCursor(endIndex) : null },
    totalCount: items.length,
  };
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */
interface AlertFilter {
  severities?: Severity[] | null;
  verdicts?: AlertVerdict[] | null;
  tenantId?: string | null;
  search?: string | null;
}
function filterAlerts(filter: AlertFilter | null | undefined): Alert[] {
  if (!filter) return alerts;
  const q = filter.search?.trim().toLowerCase();
  return alerts.filter((a) => {
    if (filter.severities?.length && !filter.severities.includes(a.severity)) return false;
    if (filter.verdicts?.length && !filter.verdicts.includes(a.verdict)) return false;
    if (filter.tenantId && a.tenant.id !== filter.tenantId) return false;
    if (q) {
      const hay = `${a.description} ${a.sourceIp} ${a.agent.hostname} ${a.attacker.name} ${a.geo?.city ?? ''} ${a.geo?.country ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function alertStats() {
  return {
    total: 65663,
    threats: 1288,
    suspected: 4317,
    cleared: 60058,
    last24h: 1284,
    deltaPct: -12,
    needsHuman: 3,
  };
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ------------------------------------------------------------------ */
/* Resolvers                                                           */
/* ------------------------------------------------------------------ */
const resolvers = {
  Query: {
    me: (): User => users[0],
    dashboardKpis: () => ({
      tenants: tenants.length,
      users: users.length,
      roles: roles.length,
    }),
    tenants: (
      _: unknown,
      args: { first?: number; after?: string; filter?: { tier?: LicenseTier; search?: string } | null },
    ): Connection<Tenant> => {
      let list = tenants;
      if (args.filter?.tier) list = list.filter((t) => t.tier === args.filter?.tier);
      if (args.filter?.search) {
        const q = args.filter.search.toLowerCase();
        list = list.filter((t) => t.name.toLowerCase().includes(q));
      }
      return paginate(list, args.first, args.after);
    },
    tenant: (_: unknown, args: { id: string }): Tenant | null => tenantById.get(args.id) ?? null,
    users: (
      _: unknown,
      args: { first?: number; after?: string; tenantId?: string; role?: string },
    ): Connection<User> => {
      let list = users;
      if (args.tenantId) list = list.filter((u) => u.tenant.id === args.tenantId);
      if (args.role) list = list.filter((u) => u.role.name === args.role || u.role.id === args.role);
      return paginate(list, args.first, args.after);
    },
    roles: (): typeof roles => [...roles].sort((a, b) => b.level - a.level),
    alerts: (_: unknown, args: { first?: number; after?: string; filter: AlertFilter }): Connection<Alert> =>
      paginate(filterAlerts(args.filter), args.first, args.after),
    alertStats: () => alertStats(),
    incidents: (
      _: unknown,
      args: { first?: number; after?: string; filter?: { status?: IncidentStatus; severity?: Severity; tenantId?: string } | null },
    ): Connection<Incident> => {
      let list = [...incidents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      if (args.filter?.status) list = list.filter((i) => i.status === args.filter?.status);
      if (args.filter?.severity) list = list.filter((i) => i.severity === args.filter?.severity);
      if (args.filter?.tenantId) list = list.filter((i) => i.tenant.id === args.filter?.tenantId);
      return paginate(list, args.first, args.after);
    },
    incident: (_: unknown, args: { id: string }): Incident | null =>
      incidents.find((i) => i.id === args.id || i.ref === args.id) ?? null,
    soarPolicy: () => soarPolicy,
    firewallIntegrations: (): typeof firewallIntegrations => firewallIntegrations,
    blockedIps: (_: unknown, args: { first?: number; after?: string; tenantId?: string }): Connection<BlockedIp> => {
      const list = args.tenantId ? blockedIps.filter((b) => b.tenant.id === args.tenantId) : blockedIps;
      return paginate(list, args.first, args.after);
    },
    licenses: (_: unknown, args: { tenantId?: string }): License[] =>
      args.tenantId ? licenses.filter((l) => l.tenant.id === args.tenantId) : licenses,
    threatIntel: () => threatIntel,
    auditLog: (
      _: unknown,
      args: { first?: number; after?: string; filter?: { kind?: string; tenantId?: string } | null },
    ): Connection<AuditEvent> => {
      let list = auditEvents;
      if (args.filter?.kind) list = list.filter((e) => e.kind === args.filter?.kind);
      if (args.filter?.tenantId) list = list.filter((e) => e.tenant?.id === args.filter?.tenantId);
      return paginate(list, args.first, args.after);
    },
  },

  DashboardKpis: {
    alertStats: () => alertStats(),
  },

  Alert: {
    /** Per-field fault demo: geo enrichment fails for one marked alert (partial data + errors). */
    geo: (alert: Alert) => {
      if (alert.id === GEO_FAIL_ALERT_ID) {
        throw new Error('geo enrichment timed out (maxmind upstream)');
      }
      return alert.geo;
    },
  },

  ThreatIntelSummary: {
    /** Partial-fault demo: forced via faults.set('ThreatIntel', 'partial'). */
    geoOrigins: (summary: typeof threatIntel, _: unknown, ctx: GatewayContext) => {
      if (ctx?.forcePartial) {
        throw new Error('geo origin enrichment unavailable (threat-feed upstream 503)');
      }
      return summary.geoOrigins;
    },
  },

  Mutation: {
    blockIp: (_: unknown, args: { input: { ip: string; tenantId: string; reason?: string } }) => {
      const { ip, tenantId, reason } = args.input;
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        return { blockedIp: null, userErrors: [{ field: 'ip', message: 'Enter a valid IPv4 address.' }] };
      }
      const tenant = tenantById.get(tenantId);
      if (!tenant) return { blockedIp: null, userErrors: [{ field: 'tenantId', message: 'Unknown tenant.' }] };
      if (blockedIps.some((b) => b.ip === ip)) {
        return { blockedIp: null, userErrors: [{ field: 'ip', message: `${ip} is already blocked.` }] };
      }
      const blocked: BlockedIp = {
        id: `B-${String(blockedIps.length + 1).padStart(2, '0')}-${Date.now() % 1000}`,
        ip,
        tenant,
        reason: reason || 'Blocked manually from console',
        score: 70,
        method: 'iptables',
        blockedBy: 'A. Kovač',
        blockedAt: new Date().toISOString(),
      };
      blockedIps.unshift(blocked);
      soarPolicy.blockedCount = blockedIps.length;
      soarPolicy.manualBlocksToday += 1;
      return { blockedIp: blocked, userErrors: [] };
    },

    unblockIp: (_: unknown, args: { ip: string; tenantId: string }) => {
      const idx = blockedIps.findIndex((b) => b.ip === args.ip);
      if (idx === -1) {
        return { unblockedIp: null, userErrors: [{ field: 'ip', message: `${args.ip} is not on the block list.` }] };
      }
      blockedIps.splice(idx, 1);
      soarPolicy.blockedCount = blockedIps.length;
      return { unblockedIp: args.ip, userErrors: [] };
    },

    createTenant: (
      _: unknown,
      args: { input: { name: string; adminEmail: string; tier: LicenseTier; dataSources?: string[] | null } },
    ) => {
      const { name, adminEmail, tier, dataSources } = args.input;
      const userErrors: Array<{ field: string; message: string }> = [];
      if (!name.trim()) userErrors.push({ field: 'name', message: 'Give the tenant a name.' });
      if (tenants.some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) {
        userErrors.push({ field: 'name', message: `A tenant named “${name.trim()}” already exists.` });
      }
      if (!isEmail(adminEmail)) userErrors.push({ field: 'adminEmail', message: 'Enter a valid admin email address.' });
      if (userErrors.length) return { tenant: null, userErrors };
      const tenant: Tenant = {
        id: `T-${String(tenants.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tier,
        status: 'ACTIVE',
        dataSources: dataSources?.length ? dataSources : ['wazuh'],
        userCount: 1,
        licensed: true,
        createdAt: new Date().toISOString(),
      };
      tenants.push(tenant);
      tenantById.set(tenant.id, tenant);
      return { tenant, userErrors: [] };
    },

    updateTenant: (_: unknown, args: { id: string; input: Partial<Pick<Tenant, 'name' | 'tier' | 'status'>> }) => {
      const tenant = tenantById.get(args.id);
      if (!tenant) return { tenant: null, userErrors: [{ field: 'id', message: 'Unknown tenant.' }] };
      Object.assign(tenant, args.input);
      return { tenant, userErrors: [] };
    },

    createUser: (
      _: unknown,
      args: { input: { name: string; email: string; tenantId: string; roleId: string } },
    ) => {
      const { name, email, tenantId, roleId } = args.input;
      const userErrors: Array<{ field: string; message: string }> = [];
      if (!name.trim()) userErrors.push({ field: 'name', message: 'Give the user a name.' });
      if (!isEmail(email)) userErrors.push({ field: 'email', message: 'Enter a valid email address.' });
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        userErrors.push({ field: 'email', message: 'That email is already registered.' });
      }
      const tenant = tenantById.get(tenantId);
      if (!tenant) userErrors.push({ field: 'tenantId', message: 'Unknown tenant.' });
      const role = roleById.get(roleId);
      if (!role) userErrors.push({ field: 'roleId', message: 'Unknown role.' });
      if (userErrors.length || !tenant || !role) return { user: null, userErrors };
      const initials = name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      const user: User = {
        id: `U-${String(users.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        email,
        initials,
        tenant,
        role,
        status: 'Invited',
        protected: false,
        lastSignIn: null,
      };
      users.push(user);
      tenant.userCount += 1;
      return { user, userErrors: [] };
    },

    updateUserRole: (_: unknown, args: { userId: string; role: string }) => {
      const user = users.find((u) => u.id === args.userId);
      if (!user) return { user: null, userErrors: [{ field: 'userId', message: 'Unknown user.' }] };
      if (user.protected) {
        return { user: null, userErrors: [{ field: 'role', message: `${user.name} is a protected system user.` }] };
      }
      const role = roles.find((r) => r.id === args.role || r.name === args.role);
      if (!role) return { user: null, userErrors: [{ field: 'role', message: 'Unknown role.' }] };
      user.role = role;
      return { user, userErrors: [] };
    },

    grantLicense: (_: unknown, args: { tenantId: string; tier: LicenseTier }) => {
      const tenant = tenantById.get(args.tenantId);
      if (!tenant) return { license: null, userErrors: [{ field: 'tenantId', message: 'Unknown tenant.' }] };
      const quota = args.tier === 'ENTERPRISE' ? 2_000_000 : args.tier === 'BUSINESS' ? 500_000 : 25_000;
      const seats = args.tier === 'ENTERPRISE' ? 25 : args.tier === 'BUSINESS' ? 10 : 3;
      const license: License = {
        id: `L-${String(licenses.length + 1).padStart(3, '0')}`,
        tenant,
        tier: args.tier,
        status: 'ACTIVE',
        key: `ZSL-${args.tier.slice(0, 3)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (args.tier === 'TRIAL' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
        seatsUsed: tenant.userCount,
        seatsTotal: seats,
        alertQuotaUsed: 0,
        alertQuotaTotal: quota,
        agentsUsed: 0,
        agentsTotal: args.tier === 'TRIAL' ? 3 : 15,
      };
      licenses.unshift(license);
      tenant.licensed = true;
      tenant.tier = args.tier;
      return { license, userErrors: [] };
    },

    revokeLicense: (_: unknown, args: { tenantId: string }) => {
      const idx = licenses.findIndex((l) => l.tenant.id === args.tenantId && l.status !== 'EXPIRED');
      if (idx === -1) {
        return { license: null, userErrors: [{ field: 'tenantId', message: 'No active license for this tenant.' }] };
      }
      const [license] = licenses.splice(idx, 1);
      license.tenant.licensed = false;
      return { license, userErrors: [] };
    },

    updateSoarPolicy: (
      _: unknown,
      args: { tenantId: string; input: Partial<Omit<typeof soarPolicy, 'engine' | 'blockedCount' | 'autoBlocksToday' | 'manualBlocksToday'>> },
    ) => {
      const { autoBlockThreshold, autoIsolateThreshold } = args.input;
      if (
        (autoBlockThreshold !== undefined && (autoBlockThreshold < 1 || autoBlockThreshold > 100)) ||
        (autoIsolateThreshold !== undefined && (autoIsolateThreshold < 1 || autoIsolateThreshold > 100))
      ) {
        return { policy: null, userErrors: [{ field: 'autoBlockThreshold', message: 'Thresholds must be between 1 and 100.' }] };
      }
      Object.assign(soarPolicy, args.input);
      return { policy: soarPolicy, userErrors: [] };
    },

    createIncident: (
      _: unknown,
      args: { input: { title: string; severity: Severity; tenantId: string; summary?: string } },
    ) => {
      const tenant = tenantById.get(args.input.tenantId);
      if (!tenant) return { incident: null, userErrors: [{ field: 'tenantId', message: 'Unknown tenant.' }] };
      if (!args.input.title.trim()) {
        return { incident: null, userErrors: [{ field: 'title', message: 'Give the incident a title.' }] };
      }
      const num = incidents.length + 45;
      const now = new Date().toISOString();
      const incident: Incident = {
        id: `I-${String(num).padStart(4, '0')}`,
        ref: `INC-${String(num).padStart(4, '0')}`,
        title: args.input.title.trim(),
        status: 'OPEN',
        severity: args.input.severity,
        tenant,
        assignee: null,
        summary: args.input.summary ?? 'Opened manually from the console.',
        createdAt: now,
        updatedAt: now,
        timeline: [{ id: `E-${num}1`, timestamp: now, actor: 'A. Kovač', kind: 'CREATED', detail: 'Incident opened manually.' }],
      };
      incidents.unshift(incident);
      return { incident, userErrors: [] };
    },

    updateIncidentStatus: (_: unknown, args: { id: string; status: IncidentStatus }) => {
      const incident = incidents.find((i) => i.id === args.id || i.ref === args.id);
      if (!incident) return { incident: null, userErrors: [{ field: 'id', message: 'Unknown incident.' }] };
      incident.status = args.status;
      incident.updatedAt = new Date().toISOString();
      incident.timeline.push({
        id: `E-${Date.now() % 100000}`,
        timestamp: incident.updatedAt,
        actor: 'A. Kovač',
        kind: 'STATUS',
        detail: `Status changed to ${args.status.charAt(0) + args.status.slice(1).toLowerCase()}.`,
      });
      return { incident, userErrors: [] };
    },

    scanEmail: (
      _: unknown,
      args: { input: { sender: string; recipient: string; subject: string; body: string; scanType: string } },
    ) => {
      const { sender, recipient, subject } = args.input;
      const userErrors: Array<{ field: string; message: string }> = [];
      if (!isEmail(sender)) userErrors.push({ field: 'sender', message: 'Enter a valid sender address.' });
      if (!isEmail(recipient)) userErrors.push({ field: 'recipient', message: 'Enter a valid recipient address.' });
      if (!subject.trim()) userErrors.push({ field: 'subject', message: 'Add the email subject.' });
      if (userErrors.length) return { scanId: null, verdict: null, score: null, summary: null, userErrors };
      const suspicious = /invoice|payment|urgent|verify|password/i.test(`${sender} ${subject} ${args.input.body}`);
      return {
        scanId: `SCAN-${Date.now() % 100000}`,
        verdict: suspicious ? 'SUSPECTED' : 'CLEAR',
        score: suspicious ? 78 : 12,
        summary: suspicious
          ? 'Look-alike domain and urgency language detected. Recommend quarantine.'
          : 'No fraud signals detected across social-engineering and header checks.',
        userErrors: [],
      };
    },
  },

  Subscription: {
    telemetryTick: {
      subscribe: () => liveStream('telemetryTick', telemetrySeed),
      resolve: (payload: unknown) => payload,
    },
    alertCreated: {
      subscribe: () => liveStream('alertCreated'),
      resolve: (payload: unknown) => payload,
    },
    incidentUpdated: {
      subscribe: () => liveStream('incidentUpdated'),
      resolve: (payload: unknown) => payload,
    },
  },
};

export const schema = makeExecutableSchema({ typeDefs, resolvers });
