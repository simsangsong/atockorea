import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Horizontally-scrolling filter row (W1.7 / spec §3.2 layer ②, §8.2). Holds
 * FilterChip children; the scrollbar is hidden for a clean chip strip.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  children,
  onClick,
  count,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={cn(
        'inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
          : 'border-admin-border bg-admin-surface text-slate-600 hover:bg-admin-surface-hover',
        className,
      )}
    >
      {children}
      {count != null ? <span className="text-xs tabular-nums opacity-70">{count}</span> : null}
    </button>
  );
}
