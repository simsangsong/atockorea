/**
 * Builder-booking cancellation email (Phase 10.6 D27 — cancellation parity).
 *
 * Sent when an itinerary-builder booking is cancelled (either customer
 * self-cancel or admin cancellation). The legacy
 * `sendBookingCancellationEmail` from `@/lib/email` is tour-product-shaped
 * (refers to `tour.title`, takes refund-eligible flag derived from
 * tour-product cancellation policy) — for builder bookings we render
 * the same emerald-on-warm-gray premium tone as the confirmation email
 * and customer-facing planner: stone-50 outer bg, mint floating card,
 * no amber surfaces.
 */

import { sendEmail } from "@/lib/email";

export interface BuilderBookingCancellationInput {
  to: string;
  bookingId: string;
  bookingReference: string | null;
  tourDate: string | null;
  numberOfGuests: number | null;
  totalKrw: number;
  customerName: string;
  /** Whether the customer is eligible for a full refund (true for
   *  card-on-file bookings cancelled before the tour-day capture; the
   *  hold is released and no money moves). */
  refundEligible: boolean;
}

export interface BuilderBookingCancellationResult {
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

function buildHtml(input: BuilderBookingCancellationInput): string {
  const hello = input.customerName ? `Hi ${escapeHtml(input.customerName)},` : "Hello,";
  const ref = input.bookingReference
    ? escapeHtml(input.bookingReference)
    : `${escapeHtml(input.bookingId.slice(0, 8))}…`;
  const tourDate = input.tourDate ? escapeHtml(input.tourDate) : "—";
  const guests = input.numberOfGuests ?? 1;
  const refundLine = input.refundEligible
    ? `The card hold for <strong style="color:#0f172a;">${fmtKrw(input.totalKrw)}</strong> has been released — no charge to your card.`
    : `We&rsquo;ll review your booking and follow up about any partial refund if applicable.`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fafaf9;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;">
    <!-- Hero card -->
    <div style="background:rgba(236,253,245,0.5);border-radius:18px;padding:28px;box-shadow:0 2px 8px rgba(15,23,42,0.04),0 22px 50px -20px rgba(15,23,42,0.20);">
      <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#475569;">
        취소됨 &middot; Cancelled
      </p>
      <h1 style="margin:0 0 10px 0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#0f172a;">${hello}</h1>
      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.55;color:#334155;">
        Your custom itinerary booking is cancelled. ${refundLine}
      </p>
      <div style="background:#ffffff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Booking</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${ref}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Tour date</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${tourDate}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Guests</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${guests}</td>
          </tr>
        </table>
      </div>
    </div>
    <p style="margin:24px 0 0 0;text-align:center;font-size:11px;color:#94a3b8;">
      AtoC Korea &middot; Booking ${escapeHtml(input.bookingId)}
    </p>
  </div>
</body></html>`;
}

export async function sendBuilderBookingCancellationEmail(
  input: BuilderBookingCancellationInput,
): Promise<BuilderBookingCancellationResult> {
  try {
    const subjectRef = input.bookingReference || input.bookingId.slice(0, 8);
    const subject = `[AtoC Korea] Your custom itinerary booking is cancelled · ${subjectRef}`;
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
