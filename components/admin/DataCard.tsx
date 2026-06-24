import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mobile list card (W1.8 / spec §5.2). Anatomy: primary title (truncate) +
 * status pill (top-right), optional secondary line, meta line, a key metric
 * (bottom-left, tabular-nums) and a CTA (bottom-right). Used as the mobile
 * fallback for admin tables.
 */
export function DataCard({
  title,
  status,
  secondary,
  meta,
  metric,
  action,
  onClick,
  className,
}: {
  title: ReactNode;
  status?: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
  metric?: ReactNode;
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-design-md border border-admin-border bg-admin-surface p-4 shadow-admin-card',
        onClick && 'cursor-pointer transition-colors hover:bg-admin-surface-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</h3>
        {status ? <div className="flex-shrink-0">{status}</div> : null}
      </div>
      {secondary ? <div className="mt-1 text-sm text-slate-600">{secondary}</div> : null}
      {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
      {metric != null || action ? (
        <div className="mt-3 flex items-end justify-between gap-2">
          <div className="text-base font-bold tabular-nums text-slate-900">{metric}</div>
          {action ? <div className="flex-shrink-0">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
