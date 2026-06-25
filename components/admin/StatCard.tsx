import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

/**
 * KPI stat card (W1.7 / spec §5.1, §8.1). Display-role value (text-2xl/bold,
 * tabular-nums) on the premium surface tokens. Pair with StatCardSkeleton while
 * loading.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon,
  chart,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sublabel?: ReactNode;
  icon?: ReactNode;
  /** Optional full-width visual (e.g. <Sparkline/>) rendered below the value (§8.4). */
  chart?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {icon ? <span className="flex-shrink-0 text-slate-400">{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-slate-500">{sublabel}</div> : null}
      {chart ? <div className="mt-3">{chart}</div> : null}
    </div>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-design-md border border-admin-border bg-admin-surface p-5',
        className,
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-24" />
    </div>
  );
}
