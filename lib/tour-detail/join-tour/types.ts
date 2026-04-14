/** Mirrors `EnhancedBookingSidebar` availability payload from GET /api/tours/[id]/availability */
export type JoinTourAvailabilityData = {
  available: boolean;
  availableSpots: number;
  maxCapacity: number | null;
  requestedGuests: number;
  canAccommodate: boolean;
  price: number;
  priceOverride: number | null;
  date: string;
};
