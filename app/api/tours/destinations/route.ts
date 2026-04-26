import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler, AppError } from '@/lib/error-handler';
import { createServerLogger } from '@/lib/logger';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';

/**
 * GET /api/tours/destinations
 *
 * Returns the full, stable list of distinct tour cities for the destination
 * filter dropdown. Decoupled from `/api/tours` so that applying a city filter
 * does not shrink the dropdown options (which would otherwise trap users in
 * the currently-selected city).
 *
 * Response shape:
 *   { destinations: Array<{ city: string; count: number }>; total: number }
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const logger = createServerLogger(req);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('tours')
    .select('id, slug, city')
    .eq('is_active', true);

  if (error) {
    logger.error('Error fetching tour destinations', undefined, { error: error.message });
    throw new AppError('Failed to fetch tour destinations', 500, 'DESTINATIONS_FETCH_ERROR', error.message);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const city = typeof (row as { city?: unknown }).city === 'string' ? (row as { city: string }).city.trim() : '';
    if (!city) continue;
    if (isTourRowHiddenFromPublicTourApi({ id: String((row as { id?: unknown }).id ?? ''), slug: (row as { slug?: string | null }).slug ?? null })) {
      continue;
    }
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  const destinations = Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => a.city.localeCompare(b.city));

  return NextResponse.json(
    {
      destinations,
      total: destinations.reduce((acc, d) => acc + d.count, 0),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
});
