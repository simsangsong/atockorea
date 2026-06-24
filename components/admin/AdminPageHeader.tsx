import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Page title block (W1.7 / spec §5.1, §7) for pages that aren't wrapped in
 * AdminPageShell. One title role per page (text-xl/semibold), optional
 * description and right-aligned actions.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
