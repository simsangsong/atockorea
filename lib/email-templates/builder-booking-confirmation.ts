/**
 * Builder-booking confirmation email (Phase 10.5e.2 — full template).
 *
 * Sent from the Stripe webhook on `payment_intent.amount_capturable_updated`
 * or `setup_intent.succeeded` for bookings with `source='itinerary_builder'`.
 *
 * Renders the same emerald-on-warm-gray tone as the planner / confirmation
 * page (stone-50 background, mint floating cards, emerald accents — no
 * amber surfaces per user direction 2026-05-29). Carries the breakdown
 * lines + stop strip the customer saw on the planner.
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

interface ItineraryBreakdownLine {
  code: string;
  amount: number;
  meta?: Record<string, unknown>;
}

interface ItineraryPayload {
  poi_keys?: string[];
  region?: string;
  /** 'private' | 'cruise' | 'dmz' — DMZ has fixed-price (duration_hours=0). */
  track?: string;
  duration_hours?: number;
  guide_language?: string;
  breakdown?: ItineraryBreakdownLine[];
}

function readItinerary(value: unknown): ItineraryPayload {
  if (!value || typeof value !== "object") return {};
  return value as ItineraryPayload;
}

/** Human-readable label for a breakdown line code. */
function lineLabel(line: ItineraryBreakdownLine): string {
  const meta = line.meta ?? {};
  switch (line.code) {
    case "base":
      return `Base — ${meta.hours ?? "?"}h ${meta.tier ?? "english"} tour`;
    case "pax_tier":
      return meta.vehicle === "van"
        ? "Van (7-9 pax)"
        : meta.peak
          ? "Solati peak season"
          : "Solati (10-13 pax)";
    case "region":
      return "Region surcharge";
    case "jeju_cross_region":
      return "Jeju cross-region";
    case "jeju_pickup":
      return `Jeju pickup (${meta.zone ?? "city"})`;
    case "dmz_base":
      return `DMZ tour (${meta.pax ?? "?"} pax)`;
    case "cruise_excursion":
      return "Cruise shore-excursion add-on";
    case "gangjeong_port":
      return "Gangjeong Port surcharge";
    default:
      return line.code;
  }
}

/**
 * Premium HTML body (Phase 10.5e.2) — emerald-on-warm-gray tone matching
 * the planner + confirmation page. Stop count + breakdown + reassurance.
 */
function buildHtml(input: BuilderBookingConfirmationInput): string {
  const it = readItinerary(input.itinerary);
  const hello = input.customerName ? `Hi ${escapeHtml(input.customerName)},` : "Hello,";
  const ref = input.bookingReference
    ? escapeHtml(input.bookingReference)
    : `${escapeHtml(input.bookingId.slice(0, 8))}…`;
  const tourDate = input.tourDate ? escapeHtml(input.tourDate) : "to be confirmed";
  const guests = input.numberOfGuests ?? 1;
  const stopsCount = it.poi_keys?.length ?? 0;
  const regionLabel = it.region
    ? escapeHtml(it.region.charAt(0).toUpperCase() + it.region.slice(1))
    : "Korea";
  const trackLabel =
    it.track === "cruise"
      ? "cruise shore excursion"
      : it.track === "dmz"
        ? "DMZ private tour"
        : "private day trip";
  const lang = it.guide_language ? ` · ${escapeHtml(it.guide_language)} guide` : "";
  const hoursStr =
    it.track === "dmz"
      ? "DMZ tour"
      : typeof it.duration_hours === "number" && it.duration_hours > 0
        ? `${it.duration_hours}h`
        : "—";
  const breakdownRows = (it.breakdown ?? [])
    .map(
      (line) =>
        `<tr><td style="padding:6px 0;color:#475569;font-size:13px;">${escapeHtml(lineLabel(line))}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;font-size:13px;">${fmtKrw(line.amount)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fafaf9;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;">
    <!-- Hero card -->
    <div style="background:rgba(236,253,245,0.5);border-radius:18px;padding:28px;box-shadow:0 2px 8px rgba(15,23,42,0.04),0 22px 50px -20px rgba(15,23,42,0.20);">
      <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#047857;">
        &#x2713; Confirmed &middot; 확정되었습니다
      </p>
      <h1 style="margin:0 0 10px 0;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#0f172a;">${hello}</h1>
      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.55;color:#334155;">
        Your custom ${trackLabel} in ${regionLabel} is confirmed. Your card is saved securely &mdash; no charge today.
        We&rsquo;ll capture <strong style="color:#0f172a;">${fmtKrw(input.totalKrw)}</strong> at 10:00 AM Korea
        time on the tour date. Free cancellation up to 24 hours before departure.
      </p>
      <!-- Details strip -->
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
          <tr>
            <td style="padding:4px 0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Day plan</td>
            <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${stopsCount} stops &middot; ${hoursStr}${lang}</td>
          </tr>
        </table>
      </div>
    </div>
    ${
      breakdownRows
        ? `<!-- Breakdown card -->
    <div style="margin-top:16px;background:rgba(236,253,245,0.4);border-radius:18px;padding:20px;box-shadow:0 1px 4px rgba(15,23,42,0.04),0 12px 30px -18px rgba(15,23,42,0.14);">
      <p style="margin:0 0 10px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Breakdown</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${breakdownRows}
        <tr><td colspan="2" style="border-top:1px solid rgba(167,243,208,0.4);padding-top:10px;"></td></tr>
        <tr><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:700;">Total</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0f172a;font-size:18px;">${fmtKrw(input.totalKrw)}</td></tr>
      </table>
    </div>`
        : ""
    }
    <!-- Reassurance row -->
    <div style="margin-top:16px;background:#ffffff;border-radius:10px;padding:12px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.04);font-size:12px;color:#047857;font-weight:600;">
      &#x2713; Card saved securely &middot; No charge today &middot; Charged on tour day &middot; 24h free cancellation
    </div>
    <p style="margin:24px 0 0 0;text-align:center;font-size:11px;color:#94a3b8;">
      AtoC Korea &middot; Booking ${escapeHtml(input.bookingId)}
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
