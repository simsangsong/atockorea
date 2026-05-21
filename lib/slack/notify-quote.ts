/**
 * Slack notification for new quote requests.
 *
 * Uses SLACK_QUOTE_WEBHOOK_URL (server-only) — set up via Slack Incoming
 * Webhook in Phase 0 of itinerary builder. The webhook URL is itself an
 * auth token; keep it out of NEXT_PUBLIC_ env vars.
 *
 * Phase 4d only does pending-manual notifications (no auto-quote yet).
 * Phase 5 will add precedent-quote suggestions.
 */

export interface QuoteNotificationData {
  quoteId: string;
  track: "private" | "cruise" | "dmz";
  region: string;
  partySize: number | null;
  requestedDate: string | null;
  contactName: string | null;
  contactEmail: string;
  language: string | null;
  poiNames: string[];
  notes: string | null;
  sourceUrl: string | null;
  intake: Record<string, unknown>;
  /** Phase 5 — auto-quote vs pending manual escalation. */
  status?: "auto_quoted" | "pending_manual";
  autoQuoteAmountKrw?: number | null;
  autoQuoteBreakdown?: Record<string, unknown> | null;
  /** Reasons the request fell out of scope (for pending_manual messages). */
  violations?: string[];
  /** Precedent precedent — older similar quote, if any. */
  precedent?: { amount_krw: number; confidence: "exact" | "loose"; sample_size: number } | null;
}

export async function notifyQuoteRequested(
  data: QuoteNotificationData
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_QUOTE_WEBHOOK_URL;
  if (!url) {
    console.warn("[notifyQuoteRequested] SLACK_QUOTE_WEBHOOK_URL not set — skipping");
    return { ok: false, error: "webhook_not_configured" };
  }

  const trackEmoji =
    data.track === "cruise" ? ":cruise_ship:" : data.track === "dmz" ? ":round_pushpin:" : ":car:";
  const statusEmoji =
    data.status === "auto_quoted" ? ":white_check_mark:" : ":warning:";
  const statusLabel =
    data.status === "auto_quoted"
      ? "AUTO-QUOTED"
      : data.violations?.length
      ? "MANUAL needed (out of scope)"
      : "MANUAL needed";
  const lines: string[] = [];
  lines.push(`${statusEmoji} ${trackEmoji} *${statusLabel}* — ${data.region.toUpperCase()} ${data.track}`);
  if (data.status === "auto_quoted" && data.autoQuoteAmountKrw != null) {
    lines.push(`*Auto-quote sent:* ₩${data.autoQuoteAmountKrw.toLocaleString()} KRW`);
  }
  if (data.violations && data.violations.length > 0) {
    lines.push(`*Violations:* ${data.violations.join(", ")}`);
  }
  if (data.precedent) {
    lines.push(
      `*Precedent:* ~₩${data.precedent.amount_krw.toLocaleString()} (${data.precedent.confidence}, n=${data.precedent.sample_size})`
    );
  }
  if (data.contactName) lines.push(`*Name:* ${data.contactName}`);
  lines.push(`*Email:* ${data.contactEmail}`);
  if (data.partySize) lines.push(`*Party:* ${data.partySize}`);
  if (data.requestedDate) lines.push(`*Date:* ${data.requestedDate}`);
  if (data.language) lines.push(`*Language:* ${data.language}`);
  if (data.intake.hours) lines.push(`*Hours ashore:* ${data.intake.hours}`);
  if (data.intake.ship) lines.push(`*Ship:* ${data.intake.ship}`);
  lines.push("");
  lines.push(`*Stops (${data.poiNames.length}):*`);
  for (let i = 0; i < data.poiNames.length; i++) {
    lines.push(`  ${i + 1}. ${data.poiNames[i]}`);
  }
  if (data.notes) {
    lines.push("");
    lines.push(`*Notes:* ${data.notes}`);
  }
  if (data.sourceUrl) {
    lines.push("");
    lines.push(`<${data.sourceUrl}|Open itinerary in builder>`);
  }
  lines.push(`*Quote ID:* \`${data.quoteId}\``);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[notifyQuoteRequested] Slack non-200:", res.status, txt);
      return { ok: false, error: `slack_status_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[notifyQuoteRequested] Slack post error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
