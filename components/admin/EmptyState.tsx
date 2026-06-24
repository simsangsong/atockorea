import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Empty / no-results state (W1.8 / spec §7). Optional icon, title, description
 * and a recovery action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-design-md border border-dashed border-admin-border bg-admin-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-slate-300">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
