/** Small shared formatters for page agents. */

/** "just now", "2m", "1h", "3d" — calm relative time for list rows. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** 65663 → "65,663" */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Severity enum → sentence-case label ("THREAT_CONFIRMED" → "Threat confirmed"). */
export function sentenceCase(enumValue: string): string {
  return enumValue
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
