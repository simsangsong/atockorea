import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Cache in memory to avoid hitting external API on every request (serverless may cold-start) */
const CACHE_MS = 60 * 60 * 1000; // 1 hour
let cached: { rate: number; updatedAt: string } | null = null;

/**
 * GET /api/currency/rate
 * Returns USD → KRW exchange rate for display/conversion.
 * - With EXCHANGE_RATE_API_KEY: exchangerate-api.com (v6 with key)
 * - Without key: open.er-api.com (free, no key, supports KRW). Attribution: https://www.exchangerate-api.com
 */
export async function GET() {
  try {
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_MS) {
      return NextResponse.json({
        rate: cached.rate,
        base: 'USD',
        target: 'KRW',
        updatedAt: cached.updatedAt,
        source: 'cache',
      });
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    let rate: number;
    let updatedAt: string;

    if (apiKey) {
      // exchangerate-api.com (optional, more control / higher limits with key)
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/KRW`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success' || data.conversion_rate == null) {
        throw new Error('Invalid response from ExchangeRate API');
      }
      rate = data.conversion_rate;
      updatedAt = new Date().toISOString();
    } else {
      // open.er-api.com (free, no API key, supports KRW; daily update)
      const res = await fetch(
        'https://open.er-api.com/v6/latest/USD',
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) throw new Error(`Open ER API error: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success' || data.rates?.KRW == null) {
        throw new Error('KRW rate not in response');
      }
      rate = data.rates.KRW;
      updatedAt = data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString()
        : new Date().toISOString();
    }

    cached = { rate, updatedAt };

    return NextResponse.json({
      rate,
      base: 'USD',
      target: 'KRW',
      updatedAt,
      source: apiKey ? 'exchangerate-api' : 'open-er-api',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch exchange rate';
    console.error('[currency/rate]', message);
    // Return a fallback rate so the UI still works (e.g. 1350)
    const fallbackRate = 1350;
    return NextResponse.json(
      {
        rate: fallbackRate,
        base: 'USD',
        target: 'KRW',
        updatedAt: new Date().toISOString(),
        source: 'fallback',
        error: message,
      },
      { status: 200 }
    );
  }
}
