import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Compact activity / recent-event row (W1.8 / spec §8.1). Icon avatar + title +
 * description + right-aligned timestamp.
 */
export function ActivityRow({
  icon,
  title,
  description,
  timestamp,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 py-3',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {icon ? (
        <div className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-admin-surface-hover text-slate-500">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{title}</p>
        {description ? <p className="truncate text-xs text-slate-500">{description}</p> : null}
      </div>
      {timestamp ? (
        <time className="flex-shrink-0 text-xs tabular-nums text-slate-400">{timestamp}</time>
      ) : null}
    </div>
  );
}
