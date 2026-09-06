import type { PillTone } from '@/components';
import type { IncidentStatus } from '@/graphql/types';

/**
 * Incident status → pill tone (Open critical-tint / Investigating medium-tint /
 * Contained brand-tint / Closed calm-tint — design/soar-incidents.md).
 */
export function statusTone(status: IncidentStatus): PillTone {
  switch (status) {
    case 'OPEN':
      return 'critical';
    case 'INVESTIGATING':
      return 'medium';
    case 'CONTAINED':
      return 'brand';
    case 'CLOSED':
      return 'calm';
  }
}
