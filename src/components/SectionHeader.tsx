import type { ReactNode } from 'react';

/**
 * SectionHeader — title + calm subline + GqlChip slot.
 *   <SectionHeader
 *     title="Fleet at a glance"
 *     subline="All tenants, last 24 hours"
 *     chip={<GqlChip kind="query">query dashboardKpis { … }</GqlChip>}
 *   />
 */
export function SectionHeader({
  title,
  subline,
  chip,
  actions,
  id,
}: {
  title: string;
  subline?: string;
  /** typically a <GqlChip/> */
  chip?: ReactNode;
  actions?: ReactNode;
  /** heading id for aria-labelledby on the wrapping <section> */
  id?: string;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id={id} className="font-display text-[15px] font-semibold">
          {title}
        </h2>
        {subline && <p className="mt-0.5 text-[12px] text-ink-3">{subline}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {chip}
      </div>
    </div>
  );
}

export default SectionHeader;
