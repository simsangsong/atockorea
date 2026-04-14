import type { TourDetailViewModel } from '@/src/types/tours';
import {
  computeEastAnchorKrwRounded,
  computeStickyUsdFromDbKrwRounded,
  currencyIsKrwDisplay,
  resolveStickyUnitKrw,
  type StickyPriceCurrencyHelpers,
} from '@/lib/tour-detail/east/services/sticky-price';
import { EAST_SIGNATURE_ANCHOR_USD } from '@/lib/tour-detail/east/constants';
import { isEastSignatureNatureCoreDetailTour } from '@/lib/tour-detail/east/east-sku';
import type { V0EastStickyBookingBarModel } from './v0-ui-types';

export type LegacyStickyBarAdapterInput = {
  tour: TourDetailViewModel;
  bookingSummaryUnitPriceKRW: number | null | undefined;
  currency: StickyPriceCurrencyHelpers | null | undefined;
  formatPrice: (amount: number) => string;
};

/**
 * Maps legacy sticky-bar pricing rules into a v0-oriented model (for future `StickyBookingBar` props).
 * Does not apply i18n — UI still uses `t('tour.*')` for labels.
 */
export function legacySmallGroupToV0EastStickyBar(input: LegacyStickyBarAdapterInput): V0EastStickyBookingBarModel {
  const { tour, bookingSummaryUnitPriceKRW, currency, formatPrice } = input;
  const listedUnitKrw = tour.price;
  const stickyUnitKrw = resolveStickyUnitKrw(listedUnitKrw, bookingSummaryUnitPriceKRW);
  const isEastUsdAnchor = isEastSignatureNatureCoreDetailTour(tour);
  const krwMode = currencyIsKrwDisplay(currency);

  if (isEastUsdAnchor) {
    const eastAnchorKrwRounded = computeEastAnchorKrwRounded(EAST_SIGNATURE_ANCHOR_USD, currency);
    return {
      pricePrefixKey: 'tour.stickyPriceFrom',
      displayMode: krwMode ? 'east_anchor_krw' : 'east_anchor_usd',
      eastAnchorKrwRounded,
      eastAnchorUsd: EAST_SIGNATURE_ANCHOR_USD,
      priceType: tour.priceType,
    };
  }

  return {
    pricePrefixKey: 'tour.stickyPriceFrom',
    displayMode: krwMode ? 'db_krw' : 'db_usd',
    unitKrw: stickyUnitKrw,
    usdFromUnitKrwRounded: computeStickyUsdFromDbKrwRounded(stickyUnitKrw, currency),
    formattedUnitKrw: formatPrice(stickyUnitKrw),
    priceType: tour.priceType,
  };
}
