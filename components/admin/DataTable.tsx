import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Generic admin table with an automatic mobile card fallback (W1.7 / spec §5.2):
 * a real <table> at md+ and stacked cards below, so every admin list is usable
 * on a phone without bespoke per-page markup. Pass `renderCard` for a tailored
 * mobile layout, or rely on the generic label/value fallback.
 */
export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  renderCard,
  empty,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  renderCard?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty != null) {
    return <>{empty}</>;
  }

  return (
    <>
      {/* Desktop: real table */}
      <div
        className={cn(
          'hidden overflow-x-auto rounded-design-md border border-admin-border md:block',
          className,
        )}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-border-strong bg-admin-surface-hover text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    c.align === 'right' && 'text-right',
                    c.headerClassName,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-admin-border bg-admin-surface last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-admin-surface-hover',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3 text-slate-700',
                      c.align === 'right' && 'text-right tabular-nums',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card fallback */}
      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <div
            key={getRowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card',
              onRowClick && 'cursor-pointer',
            )}
          >
            {renderCard ? (
              renderCard(row)
            ) : (
              <dl className="space-y-1.5">
                {columns.map((c) => (
                  <div key={c.key} className="flex items-start justify-between gap-3">
                    <dt className="text-xs font-medium text-slate-500">{c.header}</dt>
                    <dd
                      className={cn(
                        'text-right text-sm text-slate-800',
                        c.align === 'right' && 'tabular-nums',
                      )}
                    >
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
