import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** World major currencies to support (ISO 4217). API returns USD-based rates. */
export const MAJOR_CURRENCIES = [
  'USD',
  'KRW',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'HKD',
  'SGD',
  'THB',
  'AUD',
  'CAD',
  'CHF',
  'TWD',
  'INR',
  'MXN',
  'PHP',
  'IDR',
  'VND',
] as const;

const CACHE_MS = 60 * 60 * 1000; // 1 hour
type Cached = { rates: Record<string, number>; updatedAt: string };
let cached: Cached | null = null;

/**
 * GET /api/currency/rate
 * Returns USD-based exchange rates for major world currencies.
 * Used for display/conversion (prices are stored in KRW).
 * - With EXCHANGE_RATE_API_KEY: exchangerate-api.com
 * - Without key: open.er-api.com (free, no key)
 */
export async function GET() {
  try {
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < CACHE_MS) {
      return NextResponse.json({
        base: 'USD',
        rates: cached.rates,
        updatedAt: cached.updatedAt,
        source: 'cache',
      });
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    let rates: Record<string, number>;
    let updatedAt: string;

    if (apiKey) {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success' || !data.conversion_rates) {
        throw new Error('Invalid response from ExchangeRate API');
      }
      rates = data.conversion_rates as Record<string, number>;
      updatedAt = new Date().toISOString();
    } else {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`Open ER API error: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success' || !data.rates) {
        throw new Error('Rates not in response');
      }
      rates = data.rates as Record<string, number>;
      updatedAt = data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString()
        : new Date().toISOString();
    }

    if (rates.USD == null) rates.USD = 1;
    const filtered: Record<string, number> = {};
    for (const code of MAJOR_CURRENCIES) {
      if (typeof rates[code] === 'number') filtered[code] = rates[code];
    }
    if (filtered.KRW == null) filtered.KRW = 1350;
    if (filtered.USD == null) filtered.USD = 1;

    cached = { rates: filtered, updatedAt };

    return NextResponse.json({
      base: 'USD',
      rates: filtered,
      updatedAt,
      source: apiKey ? 'exchangerate-api' : 'open-er-api',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch exchange rate';
    console.error('[currency/rate]', message);
    const fallbackRates: Record<string, number> = {
      USD: 1,
      KRW: 1350,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149,
      CNY: 7.24,
      HKD: 7.82,
      SGD: 1.34,
      THB: 35,
      AUD: 1.53,
      CAD: 1.36,
      CHF: 0.88,
      TWD: 31.5,
      INR: 83,
      MXN: 17.1,
      PHP: 56,
      IDR: 15700,
      VND: 24500,
    };
    return NextResponse.json(
      {
        base: 'USD',
        rates: fallbackRates,
        updatedAt: new Date().toISOString(),
        source: 'fallback',
        error: message,
      },
      { status: 200 }
    );
  }
}
