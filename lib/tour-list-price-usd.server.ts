import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';

export type TourPriceFields = {
  price: number | string | null | undefined;
  original_price?: number | string | null | undefined;
  price_currency?: string | null | undefined;
};

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Public tour list/detail amounts in USD (major units) for API + UI + checkout.
 * DB `price_currency` KRW → divide by live KRW/USD.
 */
export function tourListPricesToUsdSync(row: TourPriceFields, krwPerUsd: number): {
  priceUsd: number;
  originalPriceUsd: number | null;
} {
  const cur = String(row.price_currency ?? 'KRW')
    .trim()
    .toUpperCase();
  const p = Number(row.price ?? 0);
  const op = row.original_price != null && row.original_price !== '' ? Number(row.original_price) : null;
  const k = krwPerUsd > 0 ? krwPerUsd : 1480;

  if (cur === 'USD') {
    return {
      priceUsd: roundUsd(Number.isFinite(p) ? p : 0),
      originalPriceUsd: op != null && Number.isFinite(op) ? roundUsd(op) : null,
    };
  }

  return {
    priceUsd: roundUsd(Number.isFinite(p) ? p / k : 0),
    originalPriceUsd: op != null && Number.isFinite(op) ? roundUsd(op / k) : null,
  };
}

export async function tourListPricesToUsd(row: TourPriceFields) {
  const krwPerUsd = await getKrwPerUsd();
  return { ...tourListPricesToUsdSync(row, krwPerUsd), krwPerUsd };
}

export function tourRowWithListPricesAsUsd<T extends Record<string, unknown>>(
  tour: T,
  krwPerUsd: number
): T {
  const pc = (tour as { price_currency?: string }).price_currency;
  const { priceUsd, originalPriceUsd } = tourListPricesToUsdSync(
    {
      price: tour.price as number,
      original_price: (tour as { original_price?: number | null }).original_price,
      price_currency: pc,
    },
    krwPerUsd
  );
  const { price_currency: _c, ...rest } = tour as T & { price_currency?: string };
  return { ...rest, price: priceUsd, original_price: originalPriceUsd } as unknown as T;
}

export function mapNestedTourToUsdRow<T extends { tours?: unknown }>(
  row: T,
  krwPerUsd: number
): T {
  const t = row.tours;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return row;
  return {
    ...row,
    tours: tourRowWithListPricesAsUsd(t as Record<string, unknown>, krwPerUsd),
  } as T;
}

export async function mapNestedTourRowsToUsd<T extends { tours?: unknown }>(
  rows: T[] | null | undefined
): Promise<T[]> {
  const list = rows ?? [];
  if (list.length === 0) return list;
  const krwPerUsd = await getKrwPerUsd();
  return list.map((row) => mapNestedTourToUsdRow(row, krwPerUsd));
}
