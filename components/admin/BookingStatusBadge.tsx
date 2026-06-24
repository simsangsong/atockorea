'use client';

/**
 * Booking status badge (W1.7 / spec §5.4) — icon + pill so the signal never
 * relies on colour alone (a11y), with calm light + navy-tinted dark variants.
 * Props are unchanged from the original colour-only badge, so existing callers
 * (orders list, dashboard) keep working.
 */
import { Check, CheckCheck, Clock, CircleSlash, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

type StatusMeta = {
  label: string;
  className: string;
  Icon: ComponentType<{ className?: string }>;
};

const STATUS: Record<string, StatusMeta> = {
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    Icon: Check,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    Icon: Clock,
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    Icon: CheckCheck,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    Icon: X,
  },
  no_show: {
    label: 'No-show',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    Icon: CircleSlash,
  },
};

const FALLBACK: StatusMeta = {
  label: '',
  className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  Icon: CircleSlash,
};

export interface BookingStatusBadgeProps {
  status: string;
  /** Optional display label; if not set, uses default label or raw status. */
  label?: string;
  /** Optional extra class names (e.g. rounded-lg). */
  className?: string;
}

export function BookingStatusBadge({ status, label, className }: BookingStatusBadgeProps) {
  const meta = STATUS[status] ?? FALLBACK;
  const displayLabel = label ?? (meta.label || status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
        meta.className,
        className,
      )}
    >
      <meta.Icon className="size-3" aria-hidden="true" />
      {displayLabel}
    </span>
  );
}
