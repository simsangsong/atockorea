/**
 * Shared USD-based FX rates for server routes (tours API, bookings, layout JSON-LD).
 * Same upstream + in-process TTL as GET /api/currency/rate.
 */

const MAJOR_CURRENCIES = [
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

const CACHE_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const FALLBACK_KRW_PER_USD = 1480;

// 2s hard timeout — without this, a slow/hanging upstream blocks every
// /api/tours request on the cold path (the rate is awaited before the
// Supabase query runs), turning a transient FX outage into a 1-minute+
// page stall. Signal must be created per-call (a module-level
// AbortSignal.timeout would self-abort 2s after process start and
// permanently fail every subsequent fetch).
const FX_UPSTREAM_TIMEOUT_MS = 2000;
function buildUpstreamFetchInit(): RequestInit {
  return {
    // T1: `cache: 'no-store'` opted every page that awaits an FX rate during
    // render (tour-product detail via checkout context) out of static/ISR
    // rendering — the exact "Dynamic server usage" bailout Next logs at build.
    // Freshness is already governed by this module's own CACHE_MS memory cache;
    // letting Next's data cache hold the upstream response for an hour keeps
    // callers ISR-eligible and changes nothing observable (rates are
    // hourly-grade data — see B4 in the perf master plan).
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FX_UPSTREAM_TIMEOUT_MS),
  } as RequestInit;
}

type Cached = { rates: Record<string, number>; updatedAt: string; isFallback?: boolean };
// Persist on globalThis so dev HMR module reloads don't reset the cache and
// re-hammer the upstream API while it's rate-limited.
const cacheStore = globalThis as unknown as { __usdRatesCache?: Cached | null };
function getCached(): Cached | null {
  return cacheStore.__usdRatesCache ?? null;
}
function setCached(value: Cached | null): void {
  cacheStore.__usdRatesCache = value;
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  KRW: FALLBACK_KRW_PER_USD,
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

export type UsdBasedRatesResult = {
  rates: Record<string, number>;
  updatedAt: string;
  source: 'cache' | 'exchangerate-api' | 'open-er-api' | 'fallback';
  error?: string;
};

export async function getUsdBasedRates(): Promise<UsdBasedRatesResult> {
  try {
    const cached = getCached();
    if (cached) {
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      // Negative cache: if we last fell back, hold the fallback for the cooldown
      // window so we don't re-hammer a rate-limited upstream.
      const ttl = cached.isFallback ? FAILURE_COOLDOWN_MS : CACHE_MS;
      if (age < ttl) {
        return {
          rates: cached.rates,
          updatedAt: cached.updatedAt,
          source: cached.isFallback ? 'fallback' : 'cache',
        };
      }
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    let rates: Record<string, number>;
    let updatedAt: string;

    if (apiKey) {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
        buildUpstreamFetchInit()
      );
      if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success' || !data.conversion_rates) {
        throw new Error('Invalid response from ExchangeRate API');
      }
      rates = data.conversion_rates as Record<string, number>;
      updatedAt = new Date().toISOString();
    } else {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', buildUpstreamFetchInit());
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
    if (filtered.KRW == null) filtered.KRW = FALLBACK_KRW_PER_USD;
    if (filtered.USD == null) filtered.USD = 1;

    setCached({ rates: filtered, updatedAt });

    return {
      rates: filtered,
      updatedAt,
      source: apiKey ? 'exchangerate-api' : 'open-er-api',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch exchange rate';
    // warn (not error) so Next.js dev doesn't surface this as a red overlay —
    // the fallback rates still serve the page correctly.
    console.warn('[usdBasedRates]', message, '— using fallback rates');
    const updatedAt = new Date().toISOString();
    setCached({ rates: FALLBACK_RATES, updatedAt, isFallback: true });
    return {
      rates: FALLBACK_RATES,
      updatedAt,
      source: 'fallback',
      error: message,
    };
  }
}

/** KRW per 1 USD (for converting DB USD list prices to app KRW). */
export async function getKrwPerUsd(): Promise<number> {
  const { rates } = await getUsdBasedRates();
  const k = rates.KRW;
  return typeof k === 'number' && k > 0 ? k : FALLBACK_KRW_PER_USD;
}
