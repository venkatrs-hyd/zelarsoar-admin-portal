/**
 * Route meta helper — the top bar eyebrow + page title come from here.
 * Keep in sync with App.tsx routes.
 */
export interface RouteMeta {
  group: string;
  section: string;
  title: string;
}

export const routeMeta: Record<string, RouteMeta> = {
  '/': { group: 'Main', section: 'Overview', title: 'Dashboard' },
  '/alerts': { group: 'Main', section: 'Detection', title: 'AI Alerts' },
  '/incidents': { group: 'Main', section: 'Response', title: 'Incidents' },
  '/soar-policies': { group: 'Main', section: 'Automation', title: 'SOAR Policies' },
  '/tenants': { group: 'Management', section: 'Organizations', title: 'Tenants' },
  '/users-roles': { group: 'Management', section: 'Access', title: 'Users & Roles' },
  '/licensing': { group: 'Management', section: 'Subscriptions', title: 'Licensing' },
  '/threat-map': { group: 'System', section: 'Intelligence', title: 'Threat Map' },
  '/audit-log': { group: 'System', section: 'Compliance', title: 'Audit Log' },
  '/design-system': { group: 'System', section: 'Foundation', title: 'Design System' },
  '/states': { group: 'System', section: 'Quality', title: 'State Gallery' },
};

const fallback: RouteMeta = { group: 'System', section: 'Not found', title: 'Page not found' };

export function getRouteMeta(pathname: string): RouteMeta {
  if (routeMeta[pathname]) return routeMeta[pathname];
  // longest-prefix match for nested paths (e.g. /incidents/I-0044)
  const key = Object.keys(routeMeta)
    .filter((p) => p !== '/' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return key ? routeMeta[key] : fallback;
}
