'use client';

import { useMemo } from 'react';
import type { TourDetailViewModel } from '@/src/types/tours';
import { useCurrencyOptional } from '@/lib/currency';
import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import { isEastSignatureNatureCoreDetailTour } from '@/lib/tour-detail/east/east-sku';
import {
  EAST_SIGNATURE_ANCHOR_USD,
  EAST_SIGNATURE_DEFAULT_LIST_KRW,
  EAST_SIGNATURE_LIST_PRICE_USD,
} from '@/lib/tour-detail/east/constants';
import {
  computeEastAnchorKrwRounded,
  computeStickyUsdFromDbKrwRounded,
  formatStickyEastKrwWon,
  resolveStickyUnitKrw,
  type StickyPriceCurrencyHelpers,
} from '@/lib/tour-detail/east/services/sticky-price';

export type EastStickyPricePresentation = {
  isEastUsdAnchor: boolean;
  /** Listed or date-specific unit in USD (API contract). */
  stickyUnitUsd: number;
  currencyIsKrw: boolean;
  eastAnchorUsd: number;
  /** Listed or date-specific unit in KRW (same units as `tour.price` / booking override). */
  stickyUnitKrw: number;
  /** East SKU + KRW UI: anchor row with leading ₩ (empty when not applicable). */
  stickyEastKrwFormatted: string;
  /** Non–East-anchor + non-KRW UI: USD rounded from DB KRW. */
  stickyUsdFromDbKrw: number;
};

/**
 * Sticky bar unit price: USD from tour API or booking summary override.
 */
export function useEastStickyPricePresentation(
  tour: TourDetailViewModel | null,
  bookingSummary: BookingPanelSummary | null
): EastStickyPricePresentation {
  const currencyCtx = useCurrencyOptional();

  return useMemo(() => {
    const currencyHelpers: StickyPriceCurrencyHelpers | null = currencyCtx
      ? {
          convertToKRW: currencyCtx.convertToKRW,
          convertToUSD: currencyCtx.convertToUSD,
          currency: currencyCtx.currency,
        }
      : null;

    if (!tour) {
      const stickyUnitKrw = EAST_SIGNATURE_DEFAULT_LIST_KRW;
      return {
        isEastUsdAnchor: false,
        stickyUnitUsd: EAST_SIGNATURE_LIST_PRICE_USD,
        currencyIsKrw: currencyCtx?.currency === 'KRW',
        eastAnchorUsd: EAST_SIGNATURE_ANCHOR_USD,
        stickyUnitKrw,
        stickyEastKrwFormatted: '',
        stickyUsdFromDbKrw: computeStickyUsdFromDbKrwRounded(stickyUnitKrw, currencyHelpers),
      };
    }

    const listedUnitUsd = tour.price;
    const stickyUnitUsd = bookingSummary?.unitPriceUsd ?? listedUnitUsd;
    const isEastUsdAnchor = isEastSignatureNatureCoreDetailTour(tour);
    const stickyUnitKrw = resolveStickyUnitKrw(tour.price, bookingSummary?.unitPriceUsd);
    const stickyEastKrwFormatted = isEastUsdAnchor
      ? formatStickyEastKrwWon(computeEastAnchorKrwRounded(EAST_SIGNATURE_ANCHOR_USD, currencyHelpers))
      : '';

    return {
      isEastUsdAnchor,
      stickyUnitUsd,
      currencyIsKrw: currencyCtx?.currency === 'KRW',
      eastAnchorUsd: EAST_SIGNATURE_ANCHOR_USD,
      stickyUnitKrw,
      stickyEastKrwFormatted,
      stickyUsdFromDbKrw: computeStickyUsdFromDbKrwRounded(stickyUnitKrw, currencyHelpers),
    };
  }, [
    tour?.price,
    tour?.slug,
    tour?.title,
    bookingSummary?.unitPriceUsd,
    currencyCtx?.currency,
    currencyCtx?.convertToKRW,
    currencyCtx?.convertToUSD,
  ]);
}
