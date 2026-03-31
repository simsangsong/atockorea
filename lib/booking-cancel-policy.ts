/**
 * User-initiated cancellation: must be at least this many hours before tour local date.
 */
export const BOOKING_CANCEL_MIN_HOURS_BEFORE_TOUR = 24;

export type BookingLikeForCancel = {
  status: string;
  /** Tour run date (DATE or ISO string) */
  tour_date?: string | null;
  /** Legacy / booking timestamp — used when tour_date missing */
  booking_date?: string | null;
};

function parseTourInstant(booking: BookingLikeForCancel): Date | null {
  const raw = booking.tour_date ?? booking.booking_date;
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Client + server: whether the user may request cancellation for this booking. */
export function canCancelBookingByPolicy(booking: BookingLikeForCancel): boolean {
  if (booking.status !== 'confirmed' && booking.status !== 'pending') return false;
  const tourAt = parseTourInstant(booking);
  if (!tourAt) return false;
  const msUntil = tourAt.getTime() - Date.now();
  const hoursUntil = msUntil / (1000 * 60 * 60);
  return hoursUntil > BOOKING_CANCEL_MIN_HOURS_BEFORE_TOUR;
}

export function bookingCancelBlockedReason(): string {
  return 'Cancellation is not allowed within 24 hours of the tour. Please contact customer support.';
}
