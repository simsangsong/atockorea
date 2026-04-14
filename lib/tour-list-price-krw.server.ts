import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';

export type TourPriceFields = {
  price: number | string | null | undefined;
  original_price?: number | string | null | undefined;
  price_currency?: string | null | undefined;
};

/**
 * `tours.price` / `original_price` are stored in `price_currency` (`KRW` | `USD`).
 * App & Stripe list flow expect KRW amounts — convert USD rows using live KRW/USD.
 */
export function tourListPricesToKrwSync(row: TourPriceFields, krwPerUsd: number): {
  priceKrw: number;
  originalPriceKrw: number | null;
} {
  const cur = String(row.price_currency ?? 'KRW')
    .trim()
    .toUpperCase();
  const p = Number(row.price ?? 0);
  const op = row.original_price != null && row.original_price !== '' ? Number(row.original_price) : null;

  if (cur === 'USD') {
    return {
      priceKrw: Math.round(p * krwPerUsd),
      originalPriceKrw:
        op != null && Number.isFinite(op) ? Math.round(op * krwPerUsd) : null,
    };
  }

  return {
    priceKrw: Math.round(Number.isFinite(p) ? p : 0),
    originalPriceKrw: op != null && Number.isFinite(op) ? Math.round(op) : null,
  };
}

export async function tourListPricesToKrw(row: TourPriceFields) {
  const krwPerUsd = await getKrwPerUsd();
  return { ...tourListPricesToKrwSync(row, krwPerUsd), krwPerUsd };
}

/** Strip storage currency after converting so clients only see KRW list amounts. */
export function tourRowWithListPricesAsKrw<T extends Record<string, unknown>>(
  tour: T,
  krwPerUsd: number
): T {
  const pc = (tour as { price_currency?: string }).price_currency;
  const { priceKrw, originalPriceKrw } = tourListPricesToKrwSync(
    {
      price: tour.price as number,
      original_price: (tour as { original_price?: number | null }).original_price,
      price_currency: pc,
    },
    krwPerUsd
  );
  const { price_currency: _c, ...rest } = tour as T & { price_currency?: string };
  return { ...rest, price: priceKrw, original_price: originalPriceKrw } as unknown as T;
}

export function mapNestedTourToKrwRow<T extends { tours?: unknown }>(
  row: T,
  krwPerUsd: number
): T {
  const t = row.tours;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return row;
  return {
    ...row,
    tours: tourRowWithListPricesAsKrw(t as Record<string, unknown>, krwPerUsd),
  } as T;
}

export async function mapNestedTourRowsToKrw<T extends { tours?: unknown }>(
  rows: T[] | null | undefined
): Promise<T[]> {
  const list = rows ?? [];
  if (list.length === 0) return list;
  const krwPerUsd = await getKrwPerUsd();
  return list.map((row) => mapNestedTourToKrwRow(row, krwPerUsd));
}
