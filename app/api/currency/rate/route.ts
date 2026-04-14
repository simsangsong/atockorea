import { NextResponse } from 'next/server';
import { getUsdBasedRates } from '@/lib/exchange/usdBasedRates.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/currency/rate
 * Returns USD-based exchange rates for major world currencies.
 * @see lib/exchange/usdBasedRates.server.ts
 */
export async function GET() {
  const result = await getUsdBasedRates();
  return NextResponse.json({
    base: 'USD',
    rates: result.rates,
    updatedAt: result.updatedAt,
    source: result.source,
    ...(result.error ? { error: result.error } : {}),
  });
}
