import { cn } from '@/lib/utils';

/**
 * Single admin spinner (W1.6 / spec §5.4) — consolidates the three ad-hoc
 * h-10/h-12/h-11 spinners scattered across admin pages. Use for the auth gate
 * and blocking actions; prefer <Skeleton> for content placeholders.
 */
const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

export function Spinner({
  size = 'md',
  className,
  label = 'Loading',
}: {
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent text-brand-blue',
        SIZES[size],
        className,
      )}
    />
  );
}
