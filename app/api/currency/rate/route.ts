import { NextResponse } from 'next/server';
import { getUsdBasedRates } from '@/lib/exchange/usdBasedRates.server';

/**
 * GET /api/currency/rate
 * Returns USD-based exchange rates for major world currencies.
 *
 * Rates already carry a 10-min in-process TTL (see usdBasedRates.server.ts), so
 * the server work per call is a memory read. The previous force-dynamic +
 * revalidate=0 stripped response caching, turning a cache-friendly value into a
 * function invocation on every page load. We now emit an explicit Cache-Control
 * so the CDN + browser reuse the JSON for the same window the data is valid.
 * @see lib/exchange/usdBasedRates.server.ts
 */
export async function GET() {
  const result = await getUsdBasedRates();
  return NextResponse.json(
    {
      base: 'USD',
      rates: result.rates,
      updatedAt: result.updatedAt,
      source: result.source,
      ...(result.error ? { error: result.error } : {}),
    },
    {
      headers: {
        // Fallback path (upstream FX outage): cache only briefly so we recover fast.
        // Normal path: browser 5 min, shared/CDN 10 min, serve stale up to 30 min.
        'Cache-Control':
          result.source === 'fallback'
            ? 'public, max-age=0, s-maxage=30'
            : 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
      },
    }
  );
}
