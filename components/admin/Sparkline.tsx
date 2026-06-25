import { cn } from '@/lib/utils';

/**
 * Minimal dependency-free sparkline (spec §8.1 / §8.4). Renders a numeric series
 * as an SVG polyline normalised to its own min/max; a flat or empty series draws
 * a muted baseline. Stroke inherits `currentColor` so callers tint via text color.
 *
 * Shared by the dashboard revenue trend (§8.1) and the analytics KPI cards (§8.4).
 */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const width = 120;
  const height = 36;
  const pad = 2;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const hasSignal = max > 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-9 w-full', className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={hasSignal ? 'currentColor' : 'rgb(203 213 225)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
