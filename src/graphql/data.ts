/**
 * In-memory seed data for the embedded gateway (design.md §4).
 * Mutations mutate these arrays in place; subscriptions read from them.
 */
import type {
  Alert,
  AptGroup,
  AuditEvent,
  BlockedIp,
  FirewallIntegration,
  GeoOrigin,
  Incident,
  License,
  Role,
  SoarPolicy,
  Tenant,
  Telemetry,
  Ttp,
  User,
} from './types';

/* ------------------------------------------------------------------ */
/* Deterministic RNG so every reload shows the same rich dataset       */
/* ------------------------------------------------------------------ */
let rngState = 42;
function rand(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function int(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/* ------------------------------------------------------------------ */
/* Tenants (8 — from the live review)                                  */
/* ------------------------------------------------------------------ */
export const tenants: Tenant[] = [
  { id: 'T-001', name: 'ZelarSoft Corp', slug: 'zelarsoft', tier: 'ENTERPRISE', status: 'ACTIVE', dataSources: ['elk'], userCount: 4, licensed: true, createdAt: '2024-02-11T09:14:00Z' },
  { id: 'T-002', name: 'Cokpit Division', slug: 'cokpit', tier: 'BUSINESS', status: 'ACTIVE', dataSources: ['wazuh'], userCount: 3, licensed: true, createdAt: '2024-05-03T14:40:00Z' },
  { id: 'T-003', name: 'VPS Infrastructure', slug: 'vps-infra', tier: 'BUSINESS', status: 'ACTIVE', dataSources: ['splunk'], userCount: 2, licensed: true, createdAt: '2024-06-19T08:02:00Z' },
  { id: 'T-004', name: 'global', slug: 'global', tier: 'BUSINESS', status: 'ACTIVE', dataSources: ['wazuh'], userCount: 1, licensed: true, createdAt: '2024-09-27T11:55:00Z' },
  { id: 'T-005', name: 'Pradhyun', slug: 'pradhyun', tier: 'TRIAL', status: 'ACTIVE', dataSources: ['elk'], userCount: 1, licensed: true, createdAt: '2026-08-12T10:20:00Z' },
  { id: 'T-006', name: 'skyits', slug: 'skyits', tier: 'TRIAL', status: 'ACTIVE', dataSources: ['wazuh'], userCount: 1, licensed: false, createdAt: '2026-07-01T16:44:00Z' },
  { id: 'T-007', name: 'Anitha Nukarapu', slug: 'anitha-n', tier: 'TRIAL', status: 'ACTIVE', dataSources: ['elk'], userCount: 0, licensed: false, createdAt: '2026-07-30T09:10:00Z' },
  { id: 'T-008', name: 'cyberhawk.Ng', slug: 'cyberhawk-ng', tier: 'TRIAL', status: 'ACTIVE', dataSources: ['wazuh'], userCount: 0, licensed: false, createdAt: '2026-08-21T13:37:00Z' },
];

const tenantById = new Map(tenants.map((t) => [t.id, t]));

/* ------------------------------------------------------------------ */
/* Roles (8 RBAC levels 100 → 20)                                      */
/* ------------------------------------------------------------------ */
export const roles: Role[] = [
  { id: 'R-100', name: 'Platform Admin', level: 100, protected: true, permissions: ['*'], userCount: 1 },
  { id: 'R-090', name: 'Tenant Admin', level: 90, protected: true, permissions: ['tenant:manage', 'users:manage', 'policies:manage', 'alerts:act'], userCount: 3 },
  { id: 'R-080', name: 'SOC Manager', level: 80, protected: true, permissions: ['alerts:act', 'incidents:manage', 'policies:read'], userCount: 1 },
  { id: 'R-070', name: 'Security Analyst', level: 70, protected: false, permissions: ['alerts:read', 'alerts:act', 'incidents:read'], userCount: 2 },
  { id: 'R-060', name: 'SOC Operator', level: 60, protected: false, permissions: ['alerts:read', 'alerts:ack'], userCount: 2 },
  { id: 'R-050', name: 'Threat Hunter', level: 50, protected: false, permissions: ['alerts:read', 'intel:read', 'hunt:run'], userCount: 1 },
  { id: 'R-030', name: 'Viewer', level: 30, protected: false, permissions: ['alerts:read'], userCount: 1 },
  { id: 'R-020', name: 'Auditor', level: 20, protected: true, permissions: ['audit:read', 'reports:read'], userCount: 1 },
];

const roleById = new Map(roles.map((r) => [r.id, r]));

/* ------------------------------------------------------------------ */
/* Users (12 across tenants)                                           */
/* ------------------------------------------------------------------ */
export const users: User[] = [
  { id: 'U-001', name: 'Ana Kovač', email: 'ana.kovac@zelarsoft.com', initials: 'AK', tenant: tenants[0], role: roles[0], status: 'Active', protected: true, lastSignIn: '2026-09-06T07:52:00Z' },
  { id: 'U-002', name: 'Milan Jovanović', email: 'm.jovanovic@cokpit.io', initials: 'MJ', tenant: tenants[1], role: roles[4], status: 'Active', protected: false, lastSignIn: '2026-09-06T08:31:00Z' },
  { id: 'U-003', name: 'Sara Lindqvist', email: 'sara.l@zelarsoft.com', initials: 'SL', tenant: tenants[0], role: roles[1], status: 'Active', protected: false, lastSignIn: '2026-09-05T19:12:00Z' },
  { id: 'U-004', name: 'David Okafor', email: 'd.okafor@vpsinfra.net', initials: 'DO', tenant: tenants[2], role: roles[2], status: 'Active', protected: false, lastSignIn: '2026-09-06T06:05:00Z' },
  { id: 'U-005', name: 'Priya Raman', email: 'priya.r@zelarsoft.com', initials: 'PR', tenant: tenants[0], role: roles[3], status: 'Active', protected: false, lastSignIn: '2026-09-06T08:58:00Z' },
  { id: 'U-006', name: 'Tomás Ferreira', email: 't.ferreira@cokpit.io', initials: 'TF', tenant: tenants[1], role: roles[1], status: 'Active', protected: false, lastSignIn: '2026-09-04T15:26:00Z' },
  { id: 'U-007', name: 'Grace Mbeki', email: 'g.mbeki@globalops.com', initials: 'GM', tenant: tenants[3], role: roles[6], status: 'Active', protected: false, lastSignIn: '2026-09-05T11:47:00Z' },
  { id: 'U-008', name: 'Henrik Olsen', email: 'h.olsen@vpsinfra.net', initials: 'HO', tenant: tenants[2], role: roles[5], status: 'Invited', protected: false, lastSignIn: null },
  { id: 'U-009', name: 'Pradhyun Reddy', email: 'pradhyun@pradhyun.dev', initials: 'PR', tenant: tenants[4], role: roles[1], status: 'Active', protected: false, lastSignIn: '2026-09-03T13:19:00Z' },
  { id: 'U-010', name: 'Kim Sky', email: 'admin@skyits.com', initials: 'KS', tenant: tenants[5], role: roles[1], status: 'Active', protected: false, lastSignIn: '2026-08-29T09:41:00Z' },
  { id: 'U-011', name: 'Zelar System', email: 'system@zelarsoar.internal', initials: 'ZS', tenant: tenants[0], role: roles[7], status: 'Active', protected: true, lastSignIn: null },
  { id: 'U-012', name: 'Ivana Marić', email: 'i.maric@cokpit.io', initials: 'IM', tenant: tenants[1], role: roles[3], status: 'Active', protected: false, lastSignIn: '2026-09-06T07:14:00Z' },
];

/* ------------------------------------------------------------------ */
/* Alerts (~60, SSH_FAILED_LOGIN botnets, real geo flavor)             */
/* ------------------------------------------------------------------ */
const geoPool = [
  { city: 'Santiago', country: 'Chile', lat: -33.45, lng: -70.66 },
  { city: 'Shizishan', country: 'China', lat: 30.94, lng: 117.78 },
  { city: 'Nairobi', country: 'Kenya', lat: -1.29, lng: 36.82 },
  { city: 'Moscow', country: 'Russia', lat: 55.75, lng: 37.62 },
  { city: 'São Paulo', country: 'Brazil', lat: -23.55, lng: -46.63 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.37, lng: 4.9 },
  { city: 'Frankfurt', country: 'Germany', lat: 50.11, lng: 8.68 },
  { city: 'Hanoi', country: 'Vietnam', lat: 21.03, lng: 105.85 },
  { city: 'Lagos', country: 'Nigeria', lat: 6.52, lng: 3.37 },
  { city: 'Kyiv', country: 'Ukraine', lat: 50.45, lng: 30.52 },
];

const attackerPool = [
  { kind: 'botnet', name: 'SSH_FAILED_LOGIN botnet' },
  { kind: 'botnet', name: 'Hydra brute-force cluster' },
  { kind: 'scanner', name: 'masscan sweep' },
  { kind: 'actor', name: 'credential stuffing list 2026-08' },
  { kind: 'botnet', name: 'Mirai variant poll' },
];

const agentPool = [
  { id: 'AG-01', hostname: 'vps-node-04' },
  { id: 'AG-02', hostname: 'zelar-edge-01' },
  { id: 'AG-03', hostname: 'cokpit-gw-02' },
  { id: 'AG-04', hostname: 'global-wazuh-01' },
  { id: 'AG-05', hostname: 'mail-relay-03' },
];

const ipPool = [
  '185.60.136.87', '45.148.10.22', '103.75.190.11', '91.240.118.172', '194.26.29.53',
  '2.58.56.101', '141.98.10.65', '89.248.165.52', '193.142.146.214', '87.121.84.14',
  '45.95.147.201', '185.220.101.4', '77.83.36.91', '212.70.149.66', '5.188.206.18',
];

const alertDescriptions = [
  'Repeated SSH password failures against root from rotating IPs',
  'SSH brute force burst followed by a successful password auth',
  'Port sweep across 22/2222/3389 within 60 seconds',
  'Impossible-travel sign-in attempt on admin console',
  'Suspected phishing email with look-alike invoice domain',
  'Wazuh rootcheck: new listener on unexpected port',
  'Splunk HEC spike: auth failure rate 14x baseline',
  'DNS query pattern matching known C2 fast-flux',
];

function makeAlert(index: number): Alert {
  const severities: Alert['severity'][] = ['CRITICAL', 'HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];
  const verdicts: Alert['verdict'][] = ['THREAT_CONFIRMED', 'SUSPECTED', 'CLEAR', 'NOISE', 'PENDING'];
  const severity = pick(severities);
  const verdict = pick(verdicts);
  const minutesAgo = int(2, 4320);
  const ts = new Date(Date.now() - minutesAgo * 60_000);
  return {
    id: `ALT-${String(10000 + index)}`,
    timestamp: ts.toISOString(),
    severity,
    verdict,
    threatScore: severity === 'CRITICAL' ? int(86, 98) : severity === 'HIGH' ? int(70, 85) : severity === 'MEDIUM' ? int(45, 69) : int(10, 44),
    attacker: pick(attackerPool),
    agent: pick(agentPool),
    sourceIp: pick(ipPool),
    geo: pick(geoPool),
    description: pick(alertDescriptions),
    tenant: tenants[int(0, 3)],
  };
}

export const alerts: Alert[] = Array.from({ length: 60 }, (_, i) => makeAlert(i)).sort(
  (a, b) => b.timestamp.localeCompare(a.timestamp),
);

/** One alert is marked: its `geo` field resolver throws (partial-error demo, design.md §4). */
export const GEO_FAIL_ALERT_ID = 'ALT-10007';

/** Curated alert that matches the dashboard mockup's top activity row. */
alerts[0] = {
  ...alerts[0],
  id: 'ALT-10061',
  severity: 'CRITICAL',
  verdict: 'THREAT_CONFIRMED',
  threatScore: 94,
  attacker: { kind: 'botnet', name: 'SSH_FAILED_LOGIN botnet' },
  agent: { id: 'AG-01', hostname: 'vps-node-04' },
  sourceIp: '185.60.136.87',
  geo: geoPool[3],
  description: 'SSH brute force against vps-node-04',
  tenant: tenants[2],
  timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),
};

/* ------------------------------------------------------------------ */
/* Blocked IPs (11, mostly iptables)                                   */
/* ------------------------------------------------------------------ */
export const blockedIps: BlockedIp[] = [
  { id: 'B-01', ip: '185.60.136.87', tenant: tenants[2], reason: 'SSH brute force confirmed', score: 94, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 2 * 60_000).toISOString() },
  { id: 'B-02', ip: '45.148.10.22', tenant: tenants[0], reason: 'Score 86 ≥ threshold 70', score: 86, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 6 * 60_000).toISOString() },
  { id: 'B-03', ip: '103.75.190.11', tenant: tenants[1], reason: 'Credential stuffing', score: 81, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 34 * 60_000).toISOString() },
  { id: 'B-04', ip: '91.240.118.172', tenant: tenants[0], reason: 'Port sweep then auth burst', score: 77, method: 'iptables', blockedBy: 'A. Kovač', blockedAt: new Date(Date.now() - 95 * 60_000).toISOString() },
  { id: 'B-05', ip: '194.26.29.53', tenant: tenants[2], reason: 'Mirai variant poll', score: 74, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 180 * 60_000).toISOString() },
  { id: 'B-06', ip: '2.58.56.101', tenant: tenants[3], reason: 'RDP spray', score: 72, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 320 * 60_000).toISOString() },
  { id: 'B-07', ip: '141.98.10.65', tenant: tenants[0], reason: 'Known scanner range', score: 71, method: 'iptables', blockedBy: 'D. Okafor', blockedAt: new Date(Date.now() - 500 * 60_000).toISOString() },
  { id: 'B-08', ip: '89.248.165.52', tenant: tenants[1], reason: 'Repeated SSH failures', score: 70, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 700 * 60_000).toISOString() },
  { id: 'B-09', ip: '193.142.146.214', tenant: tenants[2], reason: 'C2 fast-flux DNS', score: 88, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 900 * 60_000).toISOString() },
  { id: 'B-10', ip: '87.121.84.14', tenant: tenants[0], reason: 'Phishing infra (confirmed)', score: 91, method: 'iptables', blockedBy: 'P. Raman', blockedAt: new Date(Date.now() - 1300 * 60_000).toISOString() },
  { id: 'B-11', ip: '45.95.147.201', tenant: tenants[3], reason: 'SSH brute force', score: 76, method: 'iptables', blockedBy: 'SOAR Auto-Block', blockedAt: new Date(Date.now() - 1600 * 60_000).toISOString() },
];

/* ------------------------------------------------------------------ */
/* Licenses (12 records; 3 tenants currently unlicensed)               */
/* ------------------------------------------------------------------ */
const day = 24 * 60 * 60 * 1000;
export const licenses: License[] = [
  { id: 'L-001', tenant: tenants[0], tier: 'ENTERPRISE', status: 'ACTIVE', key: 'ZSL-ENT-9K2M-44XA', issuedAt: new Date(Date.now() - 210 * day).toISOString(), expiresAt: new Date(Date.now() + 155 * day).toISOString(), seatsUsed: 4, seatsTotal: 25, alertQuotaUsed: 412_300, alertQuotaTotal: 2_000_000, agentsUsed: 18, agentsTotal: 50 },
  { id: 'L-002', tenant: tenants[1], tier: 'BUSINESS', status: 'ACTIVE', key: 'ZSL-BUS-77QW-12KD', issuedAt: new Date(Date.now() - 160 * day).toISOString(), expiresAt: new Date(Date.now() + 205 * day).toISOString(), seatsUsed: 3, seatsTotal: 10, alertQuotaUsed: 188_400, alertQuotaTotal: 500_000, agentsUsed: 7, agentsTotal: 15 },
  { id: 'L-003', tenant: tenants[2], tier: 'BUSINESS', status: 'ACTIVE', key: 'ZSL-BUS-31ZZ-90PL', issuedAt: new Date(Date.now() - 120 * day).toISOString(), expiresAt: new Date(Date.now() + 245 * day).toISOString(), seatsUsed: 2, seatsTotal: 10, alertQuotaUsed: 96_750, alertQuotaTotal: 500_000, agentsUsed: 5, agentsTotal: 15 },
  { id: 'L-004', tenant: tenants[3], tier: 'BUSINESS', status: 'ACTIVE', key: 'ZSL-BUS-55NB-08RT', issuedAt: new Date(Date.now() - 90 * day).toISOString(), expiresAt: new Date(Date.now() + 275 * day).toISOString(), seatsUsed: 1, seatsTotal: 10, alertQuotaUsed: 61_200, alertQuotaTotal: 500_000, agentsUsed: 4, agentsTotal: 15 },
  { id: 'L-005', tenant: tenants[4], tier: 'TRIAL', status: 'EXPIRING', key: 'ZSL-TRL-20XC-63GH', issuedAt: new Date(Date.now() - 25 * day).toISOString(), expiresAt: new Date(Date.now() + 5 * day).toISOString(), seatsUsed: 1, seatsTotal: 3, alertQuotaUsed: 8_900, alertQuotaTotal: 25_000, agentsUsed: 2, agentsTotal: 3 },
  { id: 'L-006', tenant: tenants[4], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-11AA-00BB', issuedAt: new Date(Date.now() - 60 * day).toISOString(), expiresAt: new Date(Date.now() - 30 * day).toISOString(), seatsUsed: 1, seatsTotal: 3, alertQuotaUsed: 14_200, alertQuotaTotal: 25_000, agentsUsed: 1, agentsTotal: 3 },
  { id: 'L-007', tenant: tenants[5], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-42JK-77MN', issuedAt: new Date(Date.now() - 67 * day).toISOString(), expiresAt: new Date(Date.now() - 37 * day).toISOString(), seatsUsed: 1, seatsTotal: 3, alertQuotaUsed: 21_800, alertQuotaTotal: 25_000, agentsUsed: 3, agentsTotal: 3 },
  { id: 'L-008', tenant: tenants[5], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-83QD-19VF', issuedAt: new Date(Date.now() - 97 * day).toISOString(), expiresAt: new Date(Date.now() - 67 * day).toISOString(), seatsUsed: 1, seatsTotal: 3, alertQuotaUsed: 6_100, alertQuotaTotal: 25_000, agentsUsed: 1, agentsTotal: 3 },
  { id: 'L-009', tenant: tenants[6], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-65WS-28YU', issuedAt: new Date(Date.now() - 38 * day).toISOString(), expiresAt: new Date(Date.now() - 8 * day).toISOString(), seatsUsed: 0, seatsTotal: 3, alertQuotaUsed: 2_400, alertQuotaTotal: 25_000, agentsUsed: 0, agentsTotal: 3 },
  { id: 'L-010', tenant: tenants[6], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-07HJ-54KL', issuedAt: new Date(Date.now() - 68 * day).toISOString(), expiresAt: new Date(Date.now() - 38 * day).toISOString(), seatsUsed: 0, seatsTotal: 3, alertQuotaUsed: 900, alertQuotaTotal: 25_000, agentsUsed: 0, agentsTotal: 3 },
  { id: 'L-011', tenant: tenants[7], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-90ZX-13CV', issuedAt: new Date(Date.now() - 16 * day).toISOString(), expiresAt: new Date(Date.now() - 1 * day).toISOString(), seatsUsed: 0, seatsTotal: 3, alertQuotaUsed: 3_300, alertQuotaTotal: 25_000, agentsUsed: 0, agentsTotal: 3 },
  { id: 'L-012', tenant: tenants[7], tier: 'TRIAL', status: 'EXPIRED', key: 'ZSL-TRL-34FG-86BN', issuedAt: new Date(Date.now() - 46 * day).toISOString(), expiresAt: new Date(Date.now() - 16 * day).toISOString(), seatsUsed: 0, seatsTotal: 3, alertQuotaUsed: 1_750, alertQuotaTotal: 25_000, agentsUsed: 0, agentsTotal: 3 },
];

/* ------------------------------------------------------------------ */
/* Firewall integrations (1 connected, 7 setup required)               */
/* ------------------------------------------------------------------ */
export const firewallIntegrations: FirewallIntegration[] = [
  { id: 'FW-1', kind: 'iptables', name: 'Local iptables', status: 'CONNECTED', detail: 'Enforcing on this gateway · 11 rules managed by SOAR' },
  { id: 'FW-2', kind: 'ssh', name: 'SSH Hardening', status: 'SETUP_REQUIRED', detail: 'Push fail2ban-style rules to hosts over SSH' },
  { id: 'FW-3', kind: 'azure-nsg', name: 'Azure NSG', status: 'SETUP_REQUIRED', detail: 'Manage Network Security Group deny rules' },
  { id: 'FW-4', kind: 'aws-sg', name: 'AWS Security Groups', status: 'SETUP_REQUIRED', detail: 'Revoke ingress on demand via IAM role' },
  { id: 'FW-5', kind: 'gcp', name: 'GCP Firewall', status: 'SETUP_REQUIRED', detail: 'VPC firewall rule automation' },
  { id: 'FW-6', kind: 'cloudflare', name: 'Cloudflare WAF', status: 'SETUP_REQUIRED', detail: 'Edge IP blocks via API token' },
  { id: 'FW-7', kind: 'nginx', name: 'NGINX', status: 'SETUP_REQUIRED', detail: 'deny directives rolled out to reverse proxies' },
  { id: 'FW-8', kind: 'haproxy', name: 'HAProxy', status: 'SETUP_REQUIRED', detail: 'ACL updates via runtime API' },
];

/* ------------------------------------------------------------------ */
/* SOAR policy                                                         */
/* ------------------------------------------------------------------ */
export const soarPolicy: SoarPolicy = {
  engine: 'RUNNING',
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  businessHoursTimezone: 'UTC+1',
  businessHoursOnly: true,
  autoBlockThreshold: 70,
  autoIsolateThreshold: 80,
  blockedCount: blockedIps.length,
  autoBlocksToday: 34,
  manualBlocksToday: 6,
};

/* ------------------------------------------------------------------ */
/* Incidents (5, with timelines)                                       */
/* ------------------------------------------------------------------ */
function ev(id: string, minutesAgo: number, actor: string, kind: string, detail: string): Incident['timeline'][number] {
  return { id, timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(), actor, kind, detail };
}

export const incidents: Incident[] = [
  {
    id: 'I-0044', ref: 'INC-0044', title: 'SSH brute force campaign across VPS nodes', status: 'OPEN', severity: 'CRITICAL',
    tenant: tenants[2], assignee: 'A. Kovač',
    summary: 'Coordinated SSH_FAILED_LOGIN botnet hitting vps-node-01…07. 3 sources auto-blocked, 1 still active.',
    createdAt: new Date(Date.now() - 40 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    timeline: [
      ev('E-441', 40, 'SOAR Engine', 'CREATED', 'Incident opened from correlated alert cluster CL-8821 (14 alerts in 10 min).'),
      ev('E-442', 33, 'SOAR Engine', 'AUTO_ACTION', 'Auto-blocked 193.142.146.214 and 45.95.147.201 via iptables (score ≥ 70).'),
      ev('E-443', 12, 'A. Kovač', 'NOTE', 'Pattern matches the August campaign. Watching 185.60.136.87 before escalating to isolate.'),
      ev('E-444', 2, 'SOAR Engine', 'AUTO_ACTION', 'Auto-blocked 185.60.136.87 — score 94 ≥ threshold 70.'),
    ],
  },
  {
    id: 'I-0043', ref: 'INC-0043', title: 'Look-alike invoice domain targeting finance inbox', status: 'INVESTIGATING', severity: 'HIGH',
    tenant: tenants[0], assignee: 'P. Raman',
    summary: 'Phishing kit on zelar-pay.co impersonating billing. 2 mailboxes received the lure, both quarantined.',
    createdAt: new Date(Date.now() - 31 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    timeline: [
      ev('E-431', 31, 'SOAR Engine', 'CREATED', 'Suspected phishing email quarantined for review (sender invoice@zelar-pay.co).'),
      ev('E-432', 22, 'P. Raman', 'STATUS', 'Moved to Investigating after confirming the domain is not ours.'),
      ev('E-433', 9, 'P. Raman', 'NOTE', 'Requested takedown via registrar; blocked 87.121.84.14 at the edge.'),
    ],
  },
  {
    id: 'I-0042', ref: 'INC-0042', title: 'After-hours admin sign-in from new device', status: 'CLOSED', severity: 'MEDIUM',
    tenant: tenants[2], assignee: 'A. Kovač',
    summary: 'Impossible-travel flag on D. Okafor. Confirmed legitimate — he was travelling. False positive.',
    createdAt: new Date(Date.now() - 28 * 60 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    timeline: [
      ev('E-421', 28 * 60, 'SOAR Engine', 'CREATED', 'Impossible-travel sign-in attempt flagged on admin console.'),
      ev('E-422', 26 * 60, 'D. Okafor', 'NOTE', 'Confirmed via out-of-band call: legitimate sign-in from airport Wi-Fi.'),
      ev('E-423', 60, 'A. Kovač', 'STATUS', 'Closed — false positive confirmed.'),
    ],
  },
  {
    id: 'I-0041', ref: 'INC-0041', title: 'Splunk HEC ingestion spike on VPS Infrastructure', status: 'CONTAINED', severity: 'LOW',
    tenant: tenants[2], assignee: null,
    summary: 'Auth failure rate 14x baseline. Contained by throttling the noisiest source; root cause was a misconfigured cron job.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 20 * 60 * 60_000).toISOString(),
    timeline: [
      ev('E-411', 2 * 24 * 60, 'SOAR Engine', 'CREATED', 'Anomaly: auth failure rate 14x baseline on splunk-warn source.'),
      ev('E-412', 40 * 60, 'SOAR Engine', 'STATUS', 'Contained — noisy source throttled to 10% sampling.'),
    ],
  },
  {
    id: 'I-0040', ref: 'INC-0040', title: 'Expired trial tenant still ingesting events', status: 'CLOSED', severity: 'LOW',
    tenant: tenants[5], assignee: 'A. Kovač',
    summary: 'skyits trial lapsed but wazuh agents kept shipping. Ingest paused politely; tenant notified.',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60_000).toISOString(),
    timeline: [
      ev('E-401', 5 * 24 * 60, 'SOAR Engine', 'CREATED', 'License guard: events from expired TRIAL tenant skyits.'),
      ev('E-402', 4 * 24 * 60, 'A. Kovač', 'STATUS', 'Closed — ingest paused, renewal email sent.'),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Threat intel                                                        */
/* ------------------------------------------------------------------ */
export const threatIntel = {
  geoOrigins: [
    { country: 'Russia', count: 412, severity: 'CRITICAL' },
    { country: 'China', count: 308, severity: 'HIGH' },
    { country: 'Brazil', count: 189, severity: 'MEDIUM' },
    { country: 'Netherlands', count: 120, severity: 'MEDIUM' },
    { country: 'Germany', count: 67, severity: 'LOW' },
  ] as GeoOrigin[],
  ttps: [
    { id: 'T1110', name: 'Brute Force', count: 850 },
    { id: 'T1046', name: 'Network Service Discovery', count: 720 },
    { id: 'T1059', name: 'Command and Scripting Interpreter', count: 410 },
    { id: 'T1078', name: 'Valid Accounts', count: 380 },
    { id: 'T1498', name: 'Network Denial of Service', count: 210 },
  ] as Ttp[],
  aptGroups: [
    { name: 'APT29', confidencePct: 92 },
    { name: 'Lazarus Group', confidencePct: 78 },
    { name: 'FIN7', confidencePct: 64 },
    { name: 'APT41', confidencePct: 51 },
  ] as AptGroup[],
  topTtp: { id: 'T1110', name: 'Brute Force', count: 850 } as Ttp,
};

/* ------------------------------------------------------------------ */
/* Audit events (newest first)                                         */
/* ------------------------------------------------------------------ */
export const auditEvents: AuditEvent[] = [
  { id: 'AU-101', timestamp: new Date(Date.now() - 2 * 60_000).toISOString(), actor: 'SOAR Engine', kind: 'THREAT', action: 'Threat confirmed', detail: 'SSH brute force against vps-node-04 from 185.60.136.87', tenant: tenants[2], severity: 'CRITICAL' },
  { id: 'AU-102', timestamp: new Date(Date.now() - 6 * 60_000).toISOString(), actor: 'SOAR Engine', kind: 'AUTO_ACTION', action: 'Auto-blocked 45.148.10.22', detail: 'score 86 ≥ threshold 70 · policy Auto-Block', tenant: tenants[0], severity: null },
  { id: 'AU-103', timestamp: new Date(Date.now() - 18 * 60_000).toISOString(), actor: 'M. Jovanović', kind: 'SIGN_IN', action: 'Signed in', detail: 'SOC Operator · SSO', tenant: tenants[1], severity: null },
  { id: 'AU-104', timestamp: new Date(Date.now() - 31 * 60_000).toISOString(), actor: 'SOAR Engine', kind: 'THREAT', action: 'Phishing email quarantined', detail: 'sender invoice@zelar-pay.co held for review', tenant: tenants[0], severity: 'HIGH' },
  { id: 'AU-105', timestamp: new Date(Date.now() - 60 * 60_000).toISOString(), actor: 'A. Kovač', kind: 'INCIDENT', action: 'INC-0042 closed', detail: 'false positive confirmed · VPS Infrastructure', tenant: tenants[2], severity: null },
  { id: 'AU-106', timestamp: new Date(Date.now() - 84 * 60_000).toISOString(), actor: 'S. Lindqvist', kind: 'POLICY', action: 'SOAR policy updated', detail: 'auto-block threshold kept at 70 · business hours on', tenant: tenants[0], severity: null },
  { id: 'AU-107', timestamp: new Date(Date.now() - 120 * 60_000).toISOString(), actor: 'Zelar System', kind: 'LICENSE', action: 'Trial expiring soon', detail: 'Pradhyun TRIAL ends in 5 days', tenant: tenants[4], severity: null },
  { id: 'AU-108', timestamp: new Date(Date.now() - 150 * 60_000).toISOString(), actor: 'D. Okafor', kind: 'BLOCK', action: 'Blocked 141.98.10.65', detail: 'known scanner range · iptables', tenant: tenants[0], severity: null },
  { id: 'AU-109', timestamp: new Date(Date.now() - 200 * 60_000).toISOString(), actor: 'P. Raman', kind: 'SIGN_IN', action: 'Signed in', detail: 'Security Analyst · SSO', tenant: tenants[0], severity: null },
  { id: 'AU-110', timestamp: new Date(Date.now() - 260 * 60_000).toISOString(), actor: 'SOAR Engine', kind: 'AUTO_ACTION', action: 'Auto-blocked 2.58.56.101', detail: 'RDP spray · score 72 ≥ threshold 70', tenant: tenants[3], severity: null },
  { id: 'AU-111', timestamp: new Date(Date.now() - 320 * 60_000).toISOString(), actor: 'A. Kovač', kind: 'USER', action: 'Role changed for H. Olsen', detail: 'Viewer → Threat Hunter', tenant: tenants[2], severity: null },
  { id: 'AU-112', timestamp: new Date(Date.now() - 480 * 60_000).toISOString(), actor: 'Zelar System', kind: 'TENANT', action: 'Tenant onboarded', detail: 'cyberhawk.Ng joined as TRIAL', tenant: tenants[7], severity: null },
  { id: 'AU-113', timestamp: new Date(Date.now() - 600 * 60_000).toISOString(), actor: 'G. Mbeki', kind: 'SIGN_IN', action: 'Signed in', detail: 'Viewer · password + TOTP', tenant: tenants[3], severity: null },
  { id: 'AU-114', timestamp: new Date(Date.now() - 720 * 60_000).toISOString(), actor: 'SOAR Engine', kind: 'THREAT', action: 'C2 fast-flux DNS pattern', detail: '193.142.146.214 auto-blocked', tenant: tenants[2], severity: 'HIGH' },
];

/* ------------------------------------------------------------------ */
/* Telemetry series (24 minutes, ends at 74 ev/min like the mockup)    */
/* ------------------------------------------------------------------ */
export const telemetrySeed: Telemetry = {
  timestamp: new Date().toISOString(),
  eventsPerMinute: 74,
  series: [46, 54, 42, 60, 48, 56, 38, 52, 64, 44, 58, 40, 62, 50, 66, 42, 54, 36, 60, 46, 62, 49, 55, 74],
};

/* ------------------------------------------------------------------ */
/* Live alert generator for the alertCreated subscription              */
/* ------------------------------------------------------------------ */
let liveAlertSeq = 20000;
export function generateLiveAlert(): Alert {
  const severity = pick(['HIGH', 'MEDIUM', 'MEDIUM', 'CRITICAL', 'LOW'] as Alert['severity'][]);
  const alert: Alert = {
    id: `ALT-${liveAlertSeq++}`,
    timestamp: new Date().toISOString(),
    severity,
    verdict: severity === 'CRITICAL' || severity === 'HIGH' ? 'THREAT_CONFIRMED' : pick(['SUSPECTED', 'PENDING'] as Alert['verdict'][]),
    threatScore: severity === 'CRITICAL' ? int(86, 97) : severity === 'HIGH' ? int(70, 85) : severity === 'MEDIUM' ? int(45, 69) : int(12, 40),
    attacker: pick(attackerPool),
    agent: pick(agentPool),
    sourceIp: pick(ipPool),
    geo: pick(geoPool),
    description: pick(alertDescriptions),
    tenant: tenants[int(0, 3)],
  };
  alerts.unshift(alert);
  return alert;
}

export { tenantById, roleById };
