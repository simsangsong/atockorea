import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { buildQuoteConfirmationHtml } from "@/lib/email-templates/quote-confirmation";
import { notifyQuoteRequested } from "@/lib/slack/notify-quote";
import { isRegionSlug } from "@/lib/itinerary-builder/regions";
import {
  quote,
  tierForLocale,
  jejuZone,
  type JejuPickupZone,
  type PriceInput,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import { fingerprint } from "@/lib/quote-engine/fingerprint";
import { lookupPrecedent } from "@/lib/quote-engine/memory-lookup";
import type { QuoteIntake } from "@/lib/quote-engine/types";

/**
 * POST /api/itinerary/quote — itinerary builder quote endpoint.
 *
 * Phase 9 pipeline (replaces the Phase 5 preset model — see §B D13/D14):
 *   1. Validate input.
 *   2. Fetch cart POI regions + coords → sub-region surcharge + Jeju zones.
 *   3. quote(PriceInput) via lib/quote-engine/pricing-policy (the SAME module
 *      the client uses for the live estimate → numbers match by construction).
 *      - autoQuotable (and kill-switch on): status='auto_quoted', price emailed.
 *      - else: lookupPrecedent → status='pending_manual' + Slack escalation.
 *   4. Email + Slack are fire-and-forget so the response is not blocked.
 *
 * Body (JSON):
 *  {
 *    poi_keys: string[],                    // ordered cart (empty allowed for dmz)
 *    region: 'busan'|'jeju'|'seoul',
 *    track: 'private'|'cruise'|'dmz',
 *    guide_language?: string,               // en/ja/es/zh/zh-TW/ko (→ price tier)
 *    duration_hours?: number,               // customer-chosen 4-12h (private/cruise)
 *    party_size?: number,
 *    jeju_pickup_zone?: 'city'|'north'|'outer'|'cross_island',
 *    requested_date?: string,
 *    contact_email: string,                 // REQUIRED
 *    contact_name?, language?, notes?, locale?, intake?, source_url?
 *  }
 */

interface QuoteBody {
  poi_keys?: unknown;
  region?: unknown;
  track?: unknown;
  guide_language?: unknown;
  duration_hours?: unknown;
  party_size?: unknown;
  jeju_pickup_zone?: unknown;
  requested_date?: unknown;
  contact_email?: unknown;
  contact_name?: unknown;
  language?: unknown;
  notes?: unknown;
  locale?: unknown;
  intake?: unknown;
  source_url?: unknown;
}

const PICKUP_ZONES: JejuPickupZone[] = ["city", "north", "outer", "cross_island"];

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

  const region = typeof body.region === "string" ? body.region : "";
  if (!isRegionSlug(region)) return badRequest("region", "must be 'busan', 'jeju', or 'seoul'");

  const track = typeof body.track === "string" ? body.track : "";
  if (track !== "private" && track !== "cruise" && track !== "dmz") {
    return badRequest("track", "must be 'private', 'cruise', or 'dmz'");
  }

  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  if (!isEmail(contactEmail)) return badRequest("contact_email", "must be a valid email");

  const poiKeysRaw = Array.isArray(body.poi_keys) ? body.poi_keys : [];
  const poiKeys: string[] = poiKeysRaw
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .slice(0, 30);
  // DMZ is a fixed product with no POI building; everything else needs ≥1 stop.
  if (track !== "dmz" && poiKeys.length === 0) {
    return badRequest("poi_keys", "must include at least 1 POI");
  }

  const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : null;
  const requestedDate =
    typeof body.requested_date === "string" && body.requested_date.trim()
      ? body.requested_date.trim()
      : null;
  const partySize =
    typeof body.party_size === "number" && Number.isFinite(body.party_size) && body.party_size > 0
      ? Math.round(body.party_size)
      : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const locale = typeof body.locale === "string" ? body.locale : null;
  const bodyIntake =
    body.intake && typeof body.intake === "object" ? (body.intake as Record<string, unknown>) : {};
  const sourceUrl = typeof body.source_url === "string" ? body.source_url : null;

  // Guide language → price tier. Prefer an explicit guide_language, then the
  // legacy `language` field, then the UI locale.
  const guideLanguage =
    (typeof body.guide_language === "string" && body.guide_language.trim()) ||
    (typeof body.language === "string" && body.language.trim()) ||
    locale ||
    "en";
  const tier = tierForLocale(guideLanguage);

  const durationHours =
    typeof body.duration_hours === "number" && Number.isFinite(body.duration_hours)
      ? Math.round(body.duration_hours)
      : null;

  const jejuPickupZone =
    typeof body.jeju_pickup_zone === "string" &&
    PICKUP_ZONES.includes(body.jeju_pickup_zone as JejuPickupZone)
      ? (body.jeju_pickup_zone as JejuPickupZone)
      : null;

  const supabase = createServerClient();

  // 1) Fetch cart POI region + coords (preserves cart order)
  let poiNames: string[] = [];
  let poiRegions: string[] = [];
  let jejuPoiZones: ReturnType<typeof jejuZone>[] | undefined;
  if (poiKeys.length > 0) {
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, name_en, region, lat, lng")
      .in("poi_key", poiKeys);
    const poiByKey = new Map(
      (poiRows ?? []).map((r) => [
        r.poi_key as string,
        {
          name: (r.name_en as string) ?? (r.poi_key as string),
          region: (r.region as string) ?? "",
          lat: Number(r.lat),
          lng: Number(r.lng),
        },
      ])
    );
    const orderedPois = poiKeys
      .map((k) => poiByKey.get(k))
      .filter((p): p is NonNullable<typeof p> => !!p);
    poiNames = poiKeys.map((k) => poiByKey.get(k)?.name ?? k);
    poiRegions = orderedPois.map((p) => p.region);
    if (region === "jeju") jejuPoiZones = orderedPois.map((p) => jejuZone(p.lat, p.lng));
  }

  // 2) Authoritative compute via the shared pricing policy
  const priceInput: PriceInput = {
    track: track as PricingTrack,
    region,
    guideLanguageTier: tier,
    durationHours: durationHours ?? (track === "dmz" ? 0 : 8),
    pax: partySize ?? 2,
    requestedDate,
    jejuPickupZone,
    poiRegions,
    jejuPoiZones,
  };
  const result = quote(priceInput);

  // Kill-switch (R6): ops can force everything to manual without a deploy.
  const autoQuoteEnabled = process.env.PRICING_AUTOQUOTE_ENABLED !== "false";

  let autoQuoteAmountKrw: number | null = null;
  let autoQuoteBreakdown: Record<string, unknown> | null = null;
  let precedentId: string | null = null;
  let precedentInfo: { amount_krw: number; confidence: "exact" | "loose"; sample_size: number } | null = null;
  let finalStatus: "auto_quoted" | "pending_manual" = "pending_manual";

  if (result.autoQuotable && autoQuoteEnabled) {
    autoQuoteAmountKrw = result.total;
    autoQuoteBreakdown = result as unknown as Record<string, unknown>;
    finalStatus = "auto_quoted";
  } else {
    const engineIntake: QuoteIntake = {
      region,
      track: track as PricingTrack,
      pax: partySize,
      hours: durationHours,
      language: guideLanguage,
      poi_keys: poiKeys,
    };
    const fp = fingerprint(engineIntake);
    const match = await lookupPrecedent(supabase, fp, region, track);
    if (match) {
      precedentId = match.precedent_id;
      precedentInfo = { amount_krw: match.amount_krw, confidence: match.confidence, sample_size: match.sample_size };
    }
  }

  // 3) Persist. New pricing inputs live in the `intake` jsonb (no schema churn).
  const intakeOut: Record<string, unknown> = {
    ...bodyIntake,
    guide_language: guideLanguage,
    guide_language_tier: tier,
    vehicle: result.vehicle,
    peak_season: result.peakSeason,
    ...(durationHours != null ? { duration_hours: durationHours } : {}),
    ...(jejuPickupZone ? { jeju_pickup_zone: jejuPickupZone } : {}),
  };

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
      language: guideLanguage,
      notes,
      locale,
      intake: intakeOut,
      source_url: sourceUrl,
      status: finalStatus,
      auto_quote_amount_krw: autoQuoteAmountKrw,
      auto_quote_breakdown: autoQuoteBreakdown,
      precedent_quote_id: precedentId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[/api/itinerary/quote] DB insert error:", insertError);
    return NextResponse.json({ ok: false, error: "db_insert_failed" }, { status: 500 });
  }

  // 4) Fire-and-forget Slack + email
  const trackWord = track === "cruise" ? "cruise " : track === "dmz" ? "DMZ " : "";
  void notifyQuoteRequested({
    quoteId: inserted.id as string,
    track: track as PricingTrack,
    region,
    partySize,
    requestedDate,
    contactName,
    contactEmail,
    language: guideLanguage,
    poiNames,
    notes,
    sourceUrl,
    intake: intakeOut,
    status: finalStatus,
    autoQuoteAmountKrw,
    autoQuoteBreakdown,
    violations: result.violations,
    precedent: precedentInfo,
  });

  void sendEmail({
    to: contactEmail,
    subject:
      finalStatus === "auto_quoted"
        ? `Your AtoC Korea ${trackWord}itinerary quote — ₩${autoQuoteAmountKrw?.toLocaleString()}`
        : `Your AtoC Korea ${trackWord}itinerary request — we'll respond within 24h`,
    html: buildQuoteConfirmationHtml({
      contactName,
      region,
      track: track as PricingTrack,
      partySize,
      requestedDate,
      poiNames,
      sourceUrl,
      responseWindowHours: 24,
      autoQuoteAmountKrw,
      autoQuoteBreakdown,
    }),
  });

  return NextResponse.json({
    ok: true,
    quote_id: inserted.id,
    status: finalStatus,
    poi_count: poiKeys.length,
    auto_quote_amount_krw: autoQuoteAmountKrw,
    auto_quote_breakdown: autoQuoteBreakdown,
    violations: result.violations,
  });
}
