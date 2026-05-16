import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { buildQuoteConfirmationHtml } from "@/lib/email-templates/quote-confirmation";
import { notifyQuoteRequested } from "@/lib/slack/notify-quote";
import { isRegionSlug } from "@/lib/itinerary-builder/regions";

/**
 * POST /api/itinerary/quote — accepts a manual quote request from the
 * itinerary builder. Writes to public.tour_quote_requests, fires a Slack
 * notification (fire-and-forget), and sends a confirmation email to the
 * customer (fire-and-forget). Phase 5 will layer the auto-quote engine
 * on top of this same endpoint.
 *
 * Body shape (JSON):
 *  {
 *    poi_keys: string[],          // ordered cart
 *    region: 'busan' | 'jeju',
 *    track: 'private' | 'cruise',
 *    contact_email: string,        // REQUIRED
 *    contact_name?: string | null,
 *    requested_date?: string | null,   // ISO date
 *    party_size?: number | null,
 *    language?: string | null,
 *    notes?: string | null,
 *    locale?: string | null,
 *    intake?: Record<string, unknown>, // { hours, ship, ... } for cruise track
 *    source_url?: string | null,
 *  }
 */

interface QuoteBody {
  poi_keys?: unknown;
  region?: unknown;
  track?: unknown;
  contact_email?: unknown;
  contact_name?: unknown;
  requested_date?: unknown;
  party_size?: unknown;
  language?: unknown;
  notes?: unknown;
  locale?: unknown;
  intake?: unknown;
  source_url?: unknown;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function badRequest(field: string, why: string) {
  return NextResponse.json({ ok: false, error: `${field}: ${why}` }, { status: 400 });
}

export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return badRequest("body", "not valid JSON");
  }

  // Validate
  const region = typeof body.region === "string" ? body.region : "";
  if (!isRegionSlug(region)) return badRequest("region", "must be 'busan' or 'jeju'");

  const track = typeof body.track === "string" ? body.track : "";
  if (track !== "private" && track !== "cruise") {
    return badRequest("track", "must be 'private' or 'cruise'");
  }

  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  if (!isEmail(contactEmail)) return badRequest("contact_email", "must be a valid email");

  const poiKeysRaw = Array.isArray(body.poi_keys) ? body.poi_keys : [];
  const poiKeys: string[] = poiKeysRaw
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .slice(0, 30);
  if (poiKeys.length === 0) return badRequest("poi_keys", "must include at least 1 POI");

  const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : null;
  const requestedDate = typeof body.requested_date === "string" && body.requested_date.trim() ? body.requested_date.trim() : null;
  const partySize = typeof body.party_size === "number" && Number.isFinite(body.party_size) && body.party_size > 0 ? Math.round(body.party_size) : null;
  const language = typeof body.language === "string" ? body.language.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const locale = typeof body.locale === "string" ? body.locale : null;
  const intake = body.intake && typeof body.intake === "object" ? (body.intake as Record<string, unknown>) : {};
  const sourceUrl = typeof body.source_url === "string" ? body.source_url : null;

  // Persist (service-role)
  const supabase = createServerClient();
  const { data: inserted, error: insertError } = await supabase
    .from("tour_quote_requests")
    .insert({
      poi_keys: poiKeys,
      region,
      track,
      requested_date: requestedDate,
      party_size: partySize,
      contact_email: contactEmail,
      contact_name: contactName,
      language,
      notes,
      locale,
      intake,
      source_url: sourceUrl,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[/api/itinerary/quote] DB insert error:", insertError);
    return NextResponse.json({ ok: false, error: "db_insert_failed" }, { status: 500 });
  }

  // Look up POI display names for the Slack message + email
  const { data: poiRows } = await supabase
    .from("match_pois")
    .select("poi_key, name_en")
    .in("poi_key", poiKeys);
  const nameByKey = new Map((poiRows ?? []).map((r) => [r.poi_key as string, r.name_en as string]));
  // Preserve cart order
  const poiNames = poiKeys.map((k) => nameByKey.get(k) ?? k);

  // Fire-and-forget Slack + email (don't block the response on side effects)
  void notifyQuoteRequested({
    quoteId: inserted.id as string,
    track,
    region,
    partySize,
    requestedDate,
    contactName,
    contactEmail,
    language,
    poiNames,
    notes,
    sourceUrl,
    intake,
  });

  void sendEmail({
    to: contactEmail,
    subject:
      track === "cruise"
        ? "Your AtoC Korea cruise itinerary request — we'll respond within 24h"
        : "Your AtoC Korea itinerary request — we'll respond within 24h",
    html: buildQuoteConfirmationHtml({
      contactName,
      region,
      track,
      partySize,
      requestedDate,
      poiNames,
      sourceUrl,
      responseWindowHours: 24,
    }),
  });

  return NextResponse.json({
    ok: true,
    quote_id: inserted.id,
    status: "pending_manual",
    poi_count: poiKeys.length,
  });
}
