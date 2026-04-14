import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import type { JoinTourAvailabilityData } from '@/lib/tour-detail/join-tour/types';
import { isJejuPrivateCarTourJoin } from '@/lib/tour-detail/join-tour/join-tour-helpers';

export type JoinTourBookingSummaryInput = {
  tour: {
    title?: string;
    price: number;
    originalPrice?: number | null;
    priceType: 'person' | 'group';
  };
  selectedDate: Date | null;
  guestCount: number;
  availability: JoinTourAvailabilityData | null;
  applyDiscount: boolean;
  promoCode: string;
  preferredLanguage: 'en' | 'zh' | 'ko';
  formatPrice: (price: number) => string;
};

/**
 * Single source for `BookingPanelSummary` math used by `EnhancedBookingSidebar`
 * (and synced from `SmallGroupMobileBookingSheet` for East v2 sticky bar).
 */
export function computeJoinTourBookingPanelSummary(input: JoinTourBookingSummaryInput): BookingPanelSummary {
  const { tour, selectedDate, guestCount, availability, applyDiscount, promoCode, preferredLanguage, formatPrice } =
    input;

  /** ~KRW 45만 / 35만 / 25만 at ~1480 FX — private Jeju car join overrides in USD. */
  const JEJU_ORIGINAL_USD = 304;
  const JEJU_LIST_EN_USD = 237;
  const JEJU_LIST_ZH_USD = 169;

  const isJejuPriceOverride =
    isJejuPrivateCarTourJoin(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh');
  const hasDiscount =
    tour.originalPrice !== null && tour.originalPrice !== undefined && tour.originalPrice > tour.price;
  const basePrice = applyDiscount && hasDiscount ? tour.price : (tour.originalPrice ?? tour.price);
  const effectivePrice = availability?.price ?? basePrice;
  const subtotal = tour.priceType === 'person' ? effectivePrice * guestCount : effectivePrice;
  const promoDiscount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0;
  const totalPrice = subtotal - promoDiscount;

  const displayTotalPrice =
    isJejuPrivateCarTourJoin(tour.title) && (preferredLanguage === 'en' || preferredLanguage === 'zh')
      ? preferredLanguage === 'en'
        ? JEJU_LIST_EN_USD
        : JEJU_LIST_ZH_USD
      : totalPrice;

  const unitPriceAmount = isJejuPriceOverride
    ? displayTotalPrice
    : availability?.priceOverride ?? (applyDiscount && hasDiscount ? tour.price : (tour.originalPrice ?? tour.price));

  return {
    hasDate: selectedDate != null,
    guestCount,
    unitPriceFormatted: formatPrice(unitPriceAmount),
    unitPriceUsd: unitPriceAmount,
    totalFormatted: selectedDate != null ? formatPrice(displayTotalPrice) : null,
    priceType: tour.priceType,
  };
}
