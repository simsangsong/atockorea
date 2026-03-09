/**
 * Booking status constants for consistency across API routes and availability logic.
 * Use these instead of string literals to avoid drift and typos.
 */

/** All booking status values used in the system */
export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Statuses that count as "active" for availability and reminders:
 * pending + confirmed (not yet completed or cancelled).
 */
export const ACTIVE_BOOKING_STATUSES: readonly [string, string] = ['pending', 'confirmed'];
