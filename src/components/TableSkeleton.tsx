import Skeleton from './Skeleton';

/**
 * TableSkeleton — layout-mirroring table placeholder (8 rows by default).
 * Renders a real <table> so column widths mirror the final layout.
 *   <TableSkeleton rows={8} columns={['w-40', 'w-24', 'w-full', 'w-20']} />
 */
export function TableSkeleton({
  rows = 8,
  columns = ['w-1/5', 'w-24', 'w-2/5', 'w-24', 'w-20'],
}: {
  rows?: number;
  /** tailwind width classes, one per column */
  columns?: string[];
}) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading table">
      <span className="sr-only">Loading…</span>
      <table className="w-full border-collapse">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-line-soft last:border-b-0">
              {columns.map((w, c) => (
                <td key={c} className="px-[14px] py-[13px]">
                  <Skeleton className={`h-3 ${w}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TableSkeleton;
