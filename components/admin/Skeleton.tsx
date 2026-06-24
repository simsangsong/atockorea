import { cn } from '@/lib/utils';

/**
 * Content placeholder (W1.6 / spec §4.5). Uses the `admin-shimmer` keyframe
 * (globals.css). Prefer this over spinners for list/card loading so the page
 * keeps its shape while data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('admin-shimmer rounded-design-sm', className)} aria-hidden="true" />;
}
