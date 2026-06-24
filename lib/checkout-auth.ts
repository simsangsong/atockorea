/**
 * Ownership guard for POST /api/stripe/checkout (N14 IDOR).
 *
 * The checkout route fetches a booking by a public `bookingId` (UUID) and then
 * mutates Stripe state on it — cancelling any prior PaymentIntent/SetupIntent
 * and creating a new hold. With no ownership check, anyone who learns a valid
 * bookingId can cancel another customer's payment hold or overwrite their
 * intent (a confirmed IDOR).
 *
 * We raise the bar from "knows the UUID" to "knows the UUID *and* an email tied
 * to the booking" — the same self-verification model the chatbot booking lookup
 * uses. The caller must supply (in `bookingData.customerInfo.email`) one of the
 * booking's owner emails:
 *   - its `contact_email` (set on every guest booking), and/or
 *   - the auth email of its owning `user_id` (fallback for logged-in bookings
 *     that stored a user link but no contact email).
 *
 * IMPORTANT: the check must run against the *caller-supplied* email, never the
 * server-resolved fallback the route uses elsewhere (`customerInfo.email ??
 * booking.contact_email`) — that fallback would always equal `contact_email`
 * and defeat the guard.
 */

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export type CheckoutOwnershipResult =
  | { ok: true }
  | { ok: false; reason: 'missing_email' | 'no_owner_reference' | 'mismatch' };

/**
 * Decide whether a checkout caller has proven ownership of a booking.
 *
 * @param suppliedEmail   The email the caller put in the request body
 *                        (`bookingData.customerInfo.email`). NOT a server fallback.
 * @param acceptableEmails The booking's owner emails (contact_email and/or the
 *                        owning user's auth email). Nulls/blanks are ignored.
 */
export function verifyCheckoutOwnership(
  suppliedEmail: unknown,
  acceptableEmails: ReadonlyArray<string | null | undefined>,
): CheckoutOwnershipResult {
  const supplied = normalizeEmail(suppliedEmail);
  if (!supplied) return { ok: false, reason: 'missing_email' };

  const owners = acceptableEmails.map(normalizeEmail).filter(Boolean);
  if (owners.length === 0) return { ok: false, reason: 'no_owner_reference' };

  return owners.includes(supplied) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
