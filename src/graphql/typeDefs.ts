/**
 * ZelarSOAR Admin Portal — GraphQL SDL (design brief §3, extended per design.md §4).
 * Relay-style connections everywhere a list exists:
 *   edges { node, cursor } · pageInfo { hasNextPage, endCursor } · totalCount
 */
export const typeDefs = /* GraphQL */ `
  enum Severity {
    CRITICAL
    HIGH
    MEDIUM
    LOW
  }

  enum AlertVerdict {
    THREAT_CONFIRMED
    SUSPECTED
    CLEAR
    NOISE
    PENDING
  }

  enum IncidentStatus {
    OPEN
    INVESTIGATING
    CONTAINED
    CLOSED
  }

  enum LicenseTier {
    TRIAL
    BUSINESS
    ENTERPRISE
    CUSTOM
  }

  enum LicenseStatus {
    ACTIVE
    EXPIRING
    EXPIRED
  }

  enum StatsWindow {
    LAST_24H
    LAST_7D
    LAST_30D
  }

  enum TenantStatus {
    ACTIVE
    SUSPENDED
  }

  enum IntegrationStatus {
    CONNECTED
    SETUP_REQUIRED
    DEGRADED
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type Geo {
    city: String!
    country: String!
    lat: Float!
    lng: Float!
  }

  type Attacker {
    kind: String!
    name: String!
  }

  type Agent {
    id: ID!
    hostname: String!
  }

  type Tenant {
    id: ID!
    name: String!
    slug: String!
    tier: LicenseTier!
    status: TenantStatus!
    dataSources: [String!]!
    userCount: Int!
    licensed: Boolean!
    createdAt: String!
  }

  type TenantEdge {
    node: Tenant!
    cursor: String!
  }

  type TenantConnection {
    edges: [TenantEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    initials: String!
    tenant: Tenant!
    role: Role!
    status: String!
    protected: Boolean!
    lastSignIn: String
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Role {
    id: ID!
    name: String!
    level: Int!
    protected: Boolean!
    permissions: [String!]!
    userCount: Int!
  }

  type Alert {
    id: ID!
    timestamp: String!
    severity: Severity!
    verdict: AlertVerdict!
    threatScore: Int!
    attacker: Attacker!
    agent: Agent!
    sourceIp: String!
    """Nullable on purpose: geo enrichment is an external service and can fail per-field (partial errors)."""
    geo: Geo
    description: String!
    tenant: Tenant!
  }

  type AlertEdge {
    node: Alert!
    cursor: String!
  }

  type AlertConnection {
    edges: [AlertEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AlertStats {
    total: Int!
    threats: Int!
    suspected: Int!
    cleared: Int!
    last24h: Int!
    deltaPct: Int!
    needsHuman: Int!
  }

  type IncidentEvent {
    id: ID!
    timestamp: String!
    actor: String!
    kind: String!
    detail: String!
  }

  type Incident {
    id: ID!
    ref: String!
    title: String!
    status: IncidentStatus!
    severity: Severity!
    tenant: Tenant!
    assignee: String
    summary: String!
    createdAt: String!
    updatedAt: String!
    timeline: [IncidentEvent!]!
  }

  type IncidentEdge {
    node: Incident!
    cursor: String!
  }

  type IncidentConnection {
    edges: [IncidentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SoarPolicy {
    engine: String!
    businessHoursStart: String!
    businessHoursEnd: String!
    businessHoursTimezone: String!
    businessHoursOnly: Boolean!
    autoBlockThreshold: Int!
    autoIsolateThreshold: Int!
    blockedCount: Int!
    autoBlocksToday: Int!
    manualBlocksToday: Int!
  }

  type FirewallIntegration {
    id: ID!
    kind: String!
    name: String!
    status: IntegrationStatus!
    detail: String!
  }

  type BlockedIp {
    id: ID!
    ip: String!
    tenant: Tenant!
    reason: String!
    score: Int!
    method: String!
    blockedBy: String!
    blockedAt: String!
  }

  type BlockedIpEdge {
    node: BlockedIp!
    cursor: String!
  }

  type BlockedIpConnection {
    edges: [BlockedIpEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type License {
    id: ID!
    tenant: Tenant!
    tier: LicenseTier!
    status: LicenseStatus!
    key: String!
    issuedAt: String!
    expiresAt: String!
    seatsUsed: Int!
    seatsTotal: Int!
    alertQuotaUsed: Int!
    alertQuotaTotal: Int!
    agentsUsed: Int!
    agentsTotal: Int!
  }

  type GeoOrigin {
    country: String!
    count: Int!
    severity: Severity!
  }

  type Ttp {
    id: String!
    name: String!
    count: Int!
  }

  type AptGroup {
    name: String!
    confidencePct: Int!
  }

  type ThreatIntelSummary {
    """Nullable: geo origin enrichment can fail while the rest of the summary stays usable."""
    geoOrigins: [GeoOrigin!]
    ttps: [Ttp!]!
    aptGroups: [AptGroup!]!
    topTtp: Ttp!
  }

  type AuditEvent {
    id: ID!
    timestamp: String!
    actor: String!
    kind: String!
    action: String!
    detail: String!
    tenant: Tenant
    severity: Severity
  }

  type AuditEventEdge {
    node: AuditEvent!
    cursor: String!
  }

  type AuditEventConnection {
    edges: [AuditEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Telemetry {
    timestamp: String!
    eventsPerMinute: Int!
    series: [Int!]!
  }

  type DashboardKpis {
    tenants: Int!
    users: Int!
    roles: Int!
    alertStats(window: StatsWindow!): AlertStats!
  }

  input AlertFilter {
    severities: [Severity!]
    verdicts: [AlertVerdict!]
    tenantId: ID
    search: String
  }

  input TenantFilter {
    tier: LicenseTier
    search: String
  }

  input IncidentFilter {
    status: IncidentStatus
    severity: Severity
    tenantId: ID
  }

  input AuditFilter {
    kind: String
    tenantId: ID
  }

  input BlockIpInput {
    ip: String!
    tenantId: ID!
    reason: String
  }

  input CreateTenantInput {
    name: String!
    adminEmail: String!
    tier: LicenseTier!
    dataSources: [String!]
  }

  input UpdateTenantInput {
    name: String
    tier: LicenseTier
    status: TenantStatus
  }

  input CreateUserInput {
    name: String!
    email: String!
    tenantId: ID!
    roleId: ID!
  }

  input SoarPolicyInput {
    businessHoursOnly: Boolean
    businessHoursStart: String
    businessHoursEnd: String
    autoBlockThreshold: Int
    autoIsolateThreshold: Int
  }

  input CreateIncidentInput {
    title: String!
    severity: Severity!
    tenantId: ID!
    summary: String
    alertIds: [ID!]
  }

  input EmailScanInput {
    sender: String!
    recipient: String!
    subject: String!
    body: String!
    scanType: String!
  }

  type UserError {
    field: String
    message: String!
  }

  type BlockIpPayload {
    blockedIp: BlockedIp
    userErrors: [UserError!]!
  }

  type UnblockIpPayload {
    unblockedIp: String
    userErrors: [UserError!]!
  }

  type CreateTenantPayload {
    tenant: Tenant
    userErrors: [UserError!]!
  }

  type UpdateTenantPayload {
    tenant: Tenant
    userErrors: [UserError!]!
  }

  type CreateUserPayload {
    user: User
    userErrors: [UserError!]!
  }

  type UpdateUserPayload {
    user: User
    userErrors: [UserError!]!
  }

  type LicensePayload {
    license: License
    userErrors: [UserError!]!
  }

  type SoarPolicyPayload {
    policy: SoarPolicy
    userErrors: [UserError!]!
  }

  type IncidentPayload {
    incident: Incident
    userErrors: [UserError!]!
  }

  type EmailScanPayload {
    scanId: ID
    verdict: String
    score: Int
    summary: String
    userErrors: [UserError!]!
  }

  type Query {
    me: User!
    dashboardKpis: DashboardKpis!
    tenants(first: Int, after: String, filter: TenantFilter): TenantConnection!
    tenant(id: ID!): Tenant
    users(first: Int, after: String, tenantId: ID, role: String): UserConnection!
    roles(tenantId: ID): [Role!]!
    alerts(first: Int, after: String, filter: AlertFilter!): AlertConnection!
    alertStats(tenantId: ID, window: StatsWindow!): AlertStats!
    incidents(first: Int, after: String, filter: IncidentFilter): IncidentConnection!
    incident(id: ID!): Incident
    soarPolicy(tenantId: ID!): SoarPolicy!
    firewallIntegrations(tenantId: ID!): [FirewallIntegration!]!
    blockedIps(first: Int, after: String, tenantId: ID): BlockedIpConnection!
    licenses(tenantId: ID): [License!]!
    threatIntel(tenantId: ID): ThreatIntelSummary!
    auditLog(first: Int, after: String, filter: AuditFilter): AuditEventConnection!
  }

  type Mutation {
    blockIp(input: BlockIpInput!): BlockIpPayload!
    unblockIp(ip: String!, tenantId: ID!): UnblockIpPayload!
    createTenant(input: CreateTenantInput!): CreateTenantPayload!
    updateTenant(id: ID!, input: UpdateTenantInput!): UpdateTenantPayload!
    createUser(input: CreateUserInput!): CreateUserPayload!
    updateUserRole(userId: ID!, role: String!): UpdateUserPayload!
    grantLicense(tenantId: ID!, tier: LicenseTier!): LicensePayload!
    revokeLicense(tenantId: ID!): LicensePayload!
    updateSoarPolicy(tenantId: ID!, input: SoarPolicyInput!): SoarPolicyPayload!
    createIncident(input: CreateIncidentInput!): IncidentPayload!
    updateIncidentStatus(id: ID!, status: IncidentStatus!): IncidentPayload!
    scanEmail(input: EmailScanInput!): EmailScanPayload!
  }

  type Subscription {
    alertCreated(tenantId: ID): Alert!
    telemetryTick(tenantId: ID): Telemetry!
    incidentUpdated(tenantId: ID): Incident!
  }
`;
