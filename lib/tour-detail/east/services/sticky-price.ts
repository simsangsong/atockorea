import {
  EAST_SIGNATURE_ANCHOR_USD,
  EAST_STICKY_FALLBACK_KRW_PER_USD,
} from '@/lib/tour-detail/east/constants';

/** Minimal currency helpers used by sticky bar (matches `useCurrencyOptional()` when present). */
export type StickyPriceCurrencyHelpers = {
  convertToKRW: (usd: number) => number;
  convertToUSD: (krw: number) => number;
  currency: string;
};

/**
 * Listed KRW from DB; when sidebar reports a date-specific unit, that overrides (legacy behavior).
 */
export function resolveStickyUnitKrw(
  tourListedPriceKrw: number,
  bookingSummaryUnitPriceKRW: number | null | undefined
): number {
  return bookingSummaryUnitPriceKRW ?? tourListedPriceKrw;
}

export function computeEastAnchorKrwRounded(
  anchorUsd: number,
  currency: StickyPriceCurrencyHelpers | null | undefined
): number {
  return Math.round(
    currency ? currency.convertToKRW(anchorUsd) : anchorUsd * EAST_STICKY_FALLBACK_KRW_PER_USD
  );
}

/** Same formatting as legacy: `₩` + ko-KR grouping. */
export function formatStickyEastKrwWon(krwRounded: number): string {
  return `₩${krwRounded.toLocaleString('ko-KR')}`;
}

export function computeStickyUsdFromDbKrwRounded(
  unitKrw: number,
  currency: StickyPriceCurrencyHelpers | null | undefined
): number {
  return Math.round(
    currency ? currency.convertToUSD(unitKrw) : unitKrw / EAST_STICKY_FALLBACK_KRW_PER_USD
  );
}

export function currencyIsKrwDisplay(
  currency: StickyPriceCurrencyHelpers | null | undefined
): boolean {
  return currency?.currency === 'KRW';
}
