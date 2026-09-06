/**
 * Hand-written TS types mirroring the SDL in typeDefs.ts (no codegen — design.md §4).
 * Page agents import these for typed query results.
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertVerdict = 'THREAT_CONFIRMED' | 'SUSPECTED' | 'CLEAR' | 'NOISE' | 'PENDING';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'CLOSED';
export type LicenseTier = 'TRIAL' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM';
export type LicenseStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
export type StatsWindow = 'LAST_24H' | 'LAST_7D' | 'LAST_30D';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type IntegrationStatus = 'CONNECTED' | 'SETUP_REQUIRED' | 'DEGRADED';

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Geo {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: LicenseTier;
  status: TenantStatus;
  dataSources: string[];
  userCount: number;
  licensed: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  level: number;
  protected: boolean;
  permissions: string[];
  userCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  tenant: Tenant;
  role: Role;
  status: string;
  protected: boolean;
  lastSignIn: string | null;
}

export interface Alert {
  id: string;
  timestamp: string;
  severity: Severity;
  verdict: AlertVerdict;
  threatScore: number;
  attacker: { kind: string; name: string };
  agent: { id: string; hostname: string };
  sourceIp: string;
  geo: Geo | null;
  description: string;
  tenant: Tenant;
}

export interface AlertStats {
  total: number;
  threats: number;
  suspected: number;
  cleared: number;
  last24h: number;
  deltaPct: number;
  needsHuman: number;
}

export interface IncidentEvent {
  id: string;
  timestamp: string;
  actor: string;
  kind: string;
  detail: string;
}

export interface Incident {
  id: string;
  ref: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  tenant: Tenant;
  assignee: string | null;
  summary: string;
  createdAt: string;
  updatedAt: string;
  timeline: IncidentEvent[];
}

export interface SoarPolicy {
  engine: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessHoursTimezone: string;
  businessHoursOnly: boolean;
  autoBlockThreshold: number;
  autoIsolateThreshold: number;
  blockedCount: number;
  autoBlocksToday: number;
  manualBlocksToday: number;
}

export interface FirewallIntegration {
  id: string;
  kind: string;
  name: string;
  status: IntegrationStatus;
  detail: string;
}

export interface BlockedIp {
  id: string;
  ip: string;
  tenant: Tenant;
  reason: string;
  score: number;
  method: string;
  blockedBy: string;
  blockedAt: string;
}

export interface License {
  id: string;
  tenant: Tenant;
  tier: LicenseTier;
  status: LicenseStatus;
  key: string;
  issuedAt: string;
  expiresAt: string;
  seatsUsed: number;
  seatsTotal: number;
  alertQuotaUsed: number;
  alertQuotaTotal: number;
  agentsUsed: number;
  agentsTotal: number;
}

export interface GeoOrigin {
  country: string;
  count: number;
  severity: Severity;
}

export interface Ttp {
  id: string;
  name: string;
  count: number;
}

export interface AptGroup {
  name: string;
  confidencePct: number;
}

export interface ThreatIntelSummary {
  geoOrigins: GeoOrigin[] | null;
  ttps: Ttp[];
  aptGroups: AptGroup[];
  topTtp: Ttp;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  kind: string;
  action: string;
  detail: string;
  tenant: Tenant | null;
  severity: Severity | null;
}

export interface Telemetry {
  timestamp: string;
  eventsPerMinute: number;
  series: number[];
}

export interface UserError {
  field: string | null;
  message: string;
}
