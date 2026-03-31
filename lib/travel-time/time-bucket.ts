export type TravelTimeBucket = 'am_peak' | 'midday' | 'pm_peak' | 'weekend';

export function resolveTravelTimeBucket(departureAt?: string | Date | null): TravelTimeBucket {
  const d =
    departureAt instanceof Date
      ? departureAt
      : departureAt
        ? new Date(departureAt)
        : new Date();

  const day = d.getDay();
  const hour = d.getHours();

  if (day === 0 || day === 6) return 'weekend';
  if (hour >= 7 && hour < 10) return 'am_peak';
  if (hour >= 17 && hour < 20) return 'pm_peak';
  return 'midday';
}

export function isTravelEdgeStale(args: {
  lastVerifiedAt?: string | null;
  bucket: TravelTimeBucket;
  now?: Date;
}): boolean {
  const now = args.now ?? new Date();
  if (!args.lastVerifiedAt) return true;

  const verified = new Date(args.lastVerifiedAt);
  const ageMs = now.getTime() - verified.getTime();

  const maxAgeMs =
    args.bucket === 'weekend'
      ? 1000 * 60 * 60 * 24 * 14
      : args.bucket === 'midday'
        ? 1000 * 60 * 60 * 24 * 7
        : 1000 * 60 * 60 * 24 * 3;

  return ageMs > maxAgeMs;
}
