'use client';

/**
 * Reusable badge for booking status with consistent colors.
 * Used in admin orders list and dashboard to avoid duplicated status styling.
 */

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const DEFAULT_LABELS: Record<string, string> = {
  confirmed: '확정',
  pending: '대기',
  completed: '완료',
  cancelled: '취소',
};

export interface BookingStatusBadgeProps {
  status: string;
  /** Optional display label; if not set, uses default Korean label or raw status */
  label?: string;
  /** Optional extra class names (e.g. rounded-lg) */
  className?: string;
}

export function BookingStatusBadge({ status, label, className = '' }: BookingStatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  const displayLabel = label ?? DEFAULT_LABELS[status] ?? status;
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-md ${colorClass} ${className}`.trim()}>
      {displayLabel}
    </span>
  );
}
