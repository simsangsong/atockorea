import type { TourDetailViewModel } from '@/src/types/tours';

/** Props shape passed to `EnhancedBookingSidebar` `tour` prop (legacy small-group). */
export type EnhancedBookingSidebarTourInput = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null | undefined;
  priceType: 'person' | 'group';
  pickupPoints: TourDetailViewModel['pickupPoints'];
  recentBookings24h: number | null;
};

export function toEnhancedBookingSidebarTourInput(tour: TourDetailViewModel): EnhancedBookingSidebarTourInput {
  return {
    id: tour.id,
    title: tour.title,
    price: tour.price,
    originalPrice: tour.originalPrice,
    priceType: tour.priceType,
    pickupPoints: tour.pickupPoints,
    recentBookings24h: tour.recentBookings24h ?? null,
  };
}

/** Relative checkout URL used by legacy small-group + mobile sheet. */
export function tourCheckoutRelativePath(tourId: string): string {
  return `/tour/${encodeURIComponent(String(tourId))}/checkout`;
}
