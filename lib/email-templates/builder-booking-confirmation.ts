/**
 * Builder-booking confirmation email (Phase 10).
 *
 * Sent from the Stripe webhook on `payment_intent.amount_capturable_updated`
 * or `setup_intent.succeeded` for bookings with `source='itinerary_builder'`.
 *
 * This is a minimal Phase 2 stub — Phase 5 (5e.2) ships the full HTML email
 * with itinerary stop strip + breakdown table + 6-locale support. The stub
 * exists now so that the webhook can stop silently skipping builder bookings.
 *
 * The legacy tour-product confirmation path (`sendBookingConfirmationEmail`
 * in `@/lib/email`) gracefully handles a NULL `booking.tours` but its
 * subject/body wording assumes a parent tour, so we send a separate template
 * for builder bookings rather than reusing it.
 */

import { sendEmail } from "@/lib/email";

export interface BuilderBookingConfirmationInput {
  to: string;
  bookingId: string;
  bookingReference: string | null;
  bookingDate: string | null;
  tourDate: string | null;
  numberOfGuests: number | null;
  totalKrw: number;
  customerName: string;
  /** The `bookings.itinerary` jsonb payload as written by `createBuilderBooking`. */
  itinerary?: unknown;
  paymentStatus: "authorized" | "paid";
}

export interface BuilderBookingConfirmationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtKrw(n: number): string {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

interface ItineraryPayload {
  poi_keys?: string[];
  region?: string;
  /** 'private' | 'cruise' | 'dmz' — DMZ has fixed-price (duration_hours=0). */
  track?: string;
  duration_hours?: number;
  guide_language?: string;
}

function readItinerary(value: unknown): ItineraryPayload {
  if (!value || typeof value !== "object") return {};
  return value as ItineraryPayload;
}

/**
 * Plain-HTML body — minimal but correct. Phase 5 redesigns this into the
 * AtoC visual identity with stop thumbnails + breakdown lines.
 */
function buildHtml(input: BuilderBookingConfirmationInput): string {
  const it = readItinerary(input.itinerary);
  const hello = input.customerName ? `Hi ${escapeHtml(input.customerName)},` : "Hello,";
  const ref = input.bookingReference
    ? `<strong>${escapeHtml(input.bookingReference)}</strong>`
    : `${escapeHtml(input.bookingId.slice(0, 8))}…`;
  const tourDate = input.tourDate ? escapeHtml(input.tourDate) : "to be confirmed";
  const guests = input.numberOfGuests ?? 1;
  const stopsCount = it.poi_keys?.length ?? 0;
  const regionLabel = it.region ? escapeHtml(it.region) : "Korea";
  const trackLabel =
    it.track === "cruise"
      ? "cruise shore excursion"
      : it.track === "dmz"
        ? "DMZ private tour"
        : "private day trip";
  const lang = it.guide_language ? ` · ${escapeHtml(it.guide_language)} guide` : "";
  /**
   * Audit fix #4 — DMZ track sets duration_hours=0 (fixed-price product, no
   * customer-chosen duration). Falsy check would drop the row entirely; we
   * detect DMZ explicitly and render a label instead.
   */
  const hours =
    it.track === "dmz"
      ? " · DMZ tour"
      : typeof it.duration_hours === "number" && it.duration_hours > 0
        ? ` · ${it.duration_hours}h`
        : "";

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0f172a;">${hello}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#334155;">
      Your custom ${trackLabel} in ${regionLabel} is confirmed. Your card is saved securely — no charge today.
      We'll capture <strong>${fmtKrw(input.totalKrw)}</strong> at 10:00 AM Korea time on the tour date.
      Free cancellation up to 24 hours before departure.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;color:#1f2937;">
      <tr><td style="padding:6px 0;color:#64748b;">Booking reference</td><td style="padding:6px 0;text-align:right;">${ref}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Tour date</td><td style="padding:6px 0;text-align:right;">${tourDate}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Guests</td><td style="padding:6px 0;text-align:right;">${guests}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Stops</td><td style="padding:6px 0;text-align:right;">${stopsCount}${hours}${lang}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;">${fmtKrw(input.totalKrw)}</td></tr>
    </table>
    <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;">
      AtoC Korea · Booking ${escapeHtml(input.bookingId)}
    </p>
  </div>
</body></html>`;
}

export async function sendBuilderBookingConfirmationEmail(
  input: BuilderBookingConfirmationInput,
): Promise<BuilderBookingConfirmationResult> {
  try {
    const subjectRef = input.bookingReference || input.bookingId.slice(0, 8);
    const subject = `[AtoC Korea] Your custom itinerary is confirmed · ${subjectRef}`;
    const html = buildHtml(input);
    const result = await sendEmail({
      to: input.to,
      subject,
      html,
    });
    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
