/**
 * Quote-confirmation email template — sent to the customer immediately
 * after their itinerary-builder quote request lands (Phase 4d).
 *
 * Keep the design plain HTML for maximum email-client compatibility.
 */

export interface QuoteConfirmationEmailInput {
  contactName: string | null;
  region: string;
  track: "private" | "cruise";
  partySize: number | null;
  requestedDate: string | null;
  poiNames: string[];
  sourceUrl: string | null;
  responseWindowHours?: number;
  /** Phase 5 — when present, email renders a price card instead of the
   * pending-response copy. */
  autoQuoteAmountKrw?: number | null;
  autoQuoteBreakdown?: Record<string, unknown> | null;
}

export function buildQuoteConfirmationHtml(input: QuoteConfirmationEmailInput): string {
  const hello = input.contactName ? `Hi ${escapeHtml(input.contactName)},` : "Hello,";
  const trackLabel = input.track === "cruise" ? "cruise shore excursion" : "private day trip";
  const stops = input.poiNames
    .map((n, i) => `<li style="margin: 4px 0; padding: 0; color: #1f2937;">${i + 1}. ${escapeHtml(n)}</li>`)
    .join("");
  const windowHours = input.responseWindowHours ?? 24;
  const sourceLink = input.sourceUrl
    ? `<p style="margin: 16px 0; color: #6b7280; font-size: 13px;">
         Saved itinerary: <a href="${escapeAttr(input.sourceUrl)}" style="color: #d97706; text-decoration: underline;">re-open the builder</a>
       </p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your AtoC Korea itinerary request</title>
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f9fafb; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #92400e 100%); padding: 28px 28px 22px;">
              <p style="margin: 0 0 4px; color: #fbbf24; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                ${input.autoQuoteAmountKrw != null ? "Your quote is ready" : "Itinerary request received"}
              </p>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                ${input.autoQuoteAmountKrw != null ? `₩${input.autoQuoteAmountKrw.toLocaleString()} KRW` : `We'll respond within ${windowHours} hours`}
              </h1>
              ${input.autoQuoteAmountKrw != null ? `<p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Auto-quoted from your selected stops + duration.</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <p style="margin: 0 0 16px; color: #1f2937; font-size: 15px;">${hello}</p>
              <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.6;">
                Thanks for telling us about your trip — we've received your <strong>${trackLabel}</strong>
                request for <strong>${escapeHtml(input.region)}</strong>${input.partySize ? ` with a party of <strong>${input.partySize}</strong>` : ""}${input.requestedDate ? ` on <strong>${escapeHtml(input.requestedDate)}</strong>` : ""}.
              </p>
              ${renderBreakdown(input.autoQuoteBreakdown ?? null)}
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 18px; margin: 0 0 20px;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Your stops (${input.poiNames.length})
                </p>
                <ol style="margin: 0; padding: 0 0 0 18px; color: #1f2937; font-size: 14px;">
                  ${stops}
                </ol>
              </div>
              <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.6;">
                ${
                  input.autoQuoteAmountKrw != null
                    ? `Reply to this email to confirm and we'll send a booking link, or to adjust the route, party size, or dates.`
                    : `Our team will review the route, confirm logistics + pricing, and reply by email within <strong>${windowHours} hours</strong>${input.track === "cruise" ? " (faster if your sail date is within a week)" : ""}.`
                }
              </p>
              ${sourceLink}
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                Reply to this email if you'd like to change anything — party size, date, stops, or pickup point.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f3f4f6; padding: 16px 28px; text-align: center; color: #6b7280; font-size: 11px;">
              AtoC Korea · Custom Itinerary Service
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function renderBreakdown(breakdown: Record<string, unknown> | null): string {
  if (!breakdown) return "";
  const rows: { label: string; value: number }[] = [];
  const get = (k: string) => (typeof breakdown[k] === "number" ? (breakdown[k] as number) : 0);
  rows.push({ label: "Base", value: get("base_krw") });
  if (get("vehicle_tier_krw") > 0)
    rows.push({ label: `Vehicle (${breakdown.vehicle_tier_label ?? ""})`, value: get("vehicle_tier_krw") });
  if (get("duration_surcharge_krw") > 0)
    rows.push({ label: "Extra hours", value: get("duration_surcharge_krw") });
  if (get("distance_surcharge_krw") > 0)
    rows.push({ label: "Extra distance", value: get("distance_surcharge_krw") });
  if (get("poi_surcharge_krw") > 0)
    rows.push({ label: "Extra stops", value: get("poi_surcharge_krw") });
  if (get("language_premium_krw") > 0)
    rows.push({ label: `Language premium (${breakdown.language ?? ""})`, value: get("language_premium_krw") });
  const total = get("total_krw");
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;color:#475569;font-size:13px;">${escapeHtml(r.label)}</td><td style="padding:6px 0;color:#1e293b;font-size:13px;text-align:right;">₩${r.value.toLocaleString()}</td></tr>`
    )
    .join("");
  return `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
      <p style="margin:0 0 8px;color:#92400e;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Breakdown</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rowsHtml}
        <tr><td style="border-top:1px solid #fde68a;padding:8px 0 0;color:#1e293b;font-size:14px;font-weight:700;">Total</td><td style="border-top:1px solid #fde68a;padding:8px 0 0;color:#1e293b;font-size:14px;font-weight:700;text-align:right;">₩${total.toLocaleString()}</td></tr>
      </table>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
