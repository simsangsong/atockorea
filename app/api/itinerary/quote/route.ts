import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { buildQuoteConfirmationHtml } from "@/lib/email-templates/quote-confirmation";
import { notifyQuoteRequested } from "@/lib/slack/notify-quote";
import { isRegionSlug } from "@/lib/itinerary-builder/regions";
import { totalDriveMinutes } from "@/lib/itinerary-builder/distance";
import { loadActivePreset } from "@/lib/quote-engine/load-preset";
import { classify } from "@/lib/quote-engine/classify";
import { computeQuote } from "@/lib/quote-engine/compute";
import { fingerprint } from "@/lib/quote-engine/fingerprint";
import { lookupPrecedent } from "@/lib/quote-engine/memory-lookup";
import type { QuoteIntake, Track } from "@/lib/quote-engine/types";

/**
 * POST /api/itinerary/quote — itinerary builder quote endpoint.
 *
 * Phase 5 pipeline:
 *   1. Validate input.
 *   2. Fetch POI coords + stay minutes; compute total hours + drive km.
 *   3. loadActivePreset(region, track).
 *   4. classify(preset, intake).
 *      - In-scope: computeQuote → status='auto_quoted', price emailed instantly.
 *      - Out-of-scope (or no preset): lookupPrecedent → status='pending_manual',
 *        Slack escalation with violations + precedent reference.
 *   5. Email + Slack are fire-and-forget so the response is not blocked.
 *
 * Body shape (JSON):
 *  {
 *    poi_keys: string[],          // ordered cart
 *    region: 'busan' | 'jeju',
 *    track: 'private' | 'cruise',
 *    contact_email: string,        // REQUIRED
 *    contact_name?: string | null,
 *    requested_date?: string | null,
 *    party_size?: number | null,
 *    language?: string | null,
 *    notes?: string | null,
 *    locale?: string | null,
 *    intake?: Record<string, unknown>,
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

  const supabase = createServerClient();

  // 1) Fetch POI coords + stay minutes (preserves cart order)
  const { data: poiRows } = await supabase
    .from("match_pois")
    .select("poi_key, name_en, lat, lng, default_stay_minutes")
    .in("poi_key", poiKeys);

  const poiByKey = new Map(
    (poiRows ?? []).map((r) => [
      r.poi_key as string,
      {
        name: (r.name_en as string) ?? (r.poi_key as string),
        lat: Number(r.lat),
        lng: Number(r.lng),
        stay: Number(r.default_stay_minutes ?? 0),
      },
    ])
  );
  const orderedPois = poiKeys.map((k) => poiByKey.get(k)).filter((p): p is NonNullable<typeof p> => !!p);
  const poiNames = poiKeys.map((k) => poiByKey.get(k)?.name ?? k);

  // 2) Drive + stay totals → hours; total km from haversine×1.3 chain
  const driveMin = totalDriveMinutes(orderedPois.map((p) => ({ lat: p.lat, lng: p.lng })));
  const stayMin = orderedPois.reduce((s, p) => s + p.stay, 0);
  const totalMin = driveMin + stayMin;
  const totalHours = totalMin / 60;
  // Re-derive distance_km from drive_min @ 50km/h then back-multiply (= drive_min * 50/60)
  const distanceKm = (driveMin * 50) / 60;

  // Cruise time-budget hint from intake (if provided)
  const cruiseHours = track === "cruise" && typeof intake.hours === "number" ? (intake.hours as number) : null;
  const effectiveHours = cruiseHours && cruiseHours > 0 ? Math.min(totalHours, cruiseHours) : totalHours;

  const engineIntake: QuoteIntake = {
    region,
    track: track as Track,
    pax: partySize,
    hours: effectiveHours,
    distance_km: distanceKm,
    language: language || locale || "en",
    poi_keys: poiKeys,
  };

  // 3) Load active preset for (region, track)
  const preset = await loadActivePreset(supabase, region, track as Track);
  const presetVerdict = preset ? classify(preset, engineIntake) : { in_scope: false, violations: ["no_active_preset"] };

  // 4) Branch — auto-quote vs pending
  let autoQuoteAmountKrw: number | null = null;
  let autoQuoteBreakdown: Record<string, unknown> | null = null;
  let precedentId: string | null = null;
  let precedentInfo: { amount_krw: number; confidence: "exact" | "loose"; sample_size: number } | null = null;
  let finalStatus: "auto_quoted" | "pending_manual" = "pending_manual";

  if (preset && presetVerdict.in_scope) {
    const breakdown = computeQuote(preset, engineIntake);
    autoQuoteAmountKrw = breakdown.total_krw;
    autoQuoteBreakdown = breakdown as unknown as Record<string, unknown>;
    finalStatus = "auto_quoted";
  } else {
    // Out-of-scope: try precedent
    const fp = fingerprint(engineIntake);
    const match = await lookupPrecedent(supabase, fp, region, track);
    if (match) {
      precedentId = match.precedent_id;
      precedentInfo = { amount_krw: match.amount_krw, confidence: match.confidence, sample_size: match.sample_size };
    }
  }

  // 5) Persist
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

  // 6) Fire-and-forget Slack + email
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
    status: finalStatus,
    autoQuoteAmountKrw,
    autoQuoteBreakdown,
    violations: presetVerdict.violations,
    precedent: precedentInfo,
  });

  void sendEmail({
    to: contactEmail,
    subject:
      finalStatus === "auto_quoted"
        ? `Your AtoC Korea ${track === "cruise" ? "cruise" : ""} itinerary quote — ₩${autoQuoteAmountKrw?.toLocaleString()}`.replace("  ", " ")
        : track === "cruise"
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
      autoQuoteAmountKrw,
      autoQuoteBreakdown: autoQuoteBreakdown as Record<string, unknown> | null,
    }),
  });

  return NextResponse.json({
    ok: true,
    quote_id: inserted.id,
    status: finalStatus,
    poi_count: poiKeys.length,
    auto_quote_amount_krw: autoQuoteAmountKrw,
    auto_quote_breakdown: autoQuoteBreakdown,
  });
}
