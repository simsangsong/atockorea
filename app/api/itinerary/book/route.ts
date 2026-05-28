import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { isRegionSlug, type RegionSlug } from "@/lib/itinerary-builder/regions";
import {
  quote,
  tierForLocale,
  jejuZone,
  type JejuPickupZone,
  type PriceInput,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import { createBuilderBooking } from "@/lib/booking/createBuilderBooking";
import { trackEvent } from "@/src/design/analytics";

/**
 * POST /api/itinerary/book — itinerary-builder booking endpoint (Phase 10.5).
 *
 * Replaces the legacy `/api/itinerary/quote` proposal pipe. Creates a real
 * `bookings` row with `source='itinerary_builder'` + `currency='krw'`. The
 * caller then redirects the user to `/itinerary-builder/checkout?bookingId=…`
 * where the standard `/api/stripe/checkout` mints a PI/SI for the card hold.
 *
 * Discipline (per spin-off planner §D Phase 5):
 *   - Server-authoritative price recompute via `pricing-policy.quote()` —
 *     mirrors `/api/bookings` price-mismatch defense at lines 298-309. If the
 *     `client_quoted_total` deviates from the server total by >₩1, return 409
 *     with the new total so the UI can show a re-confirm prompt instead of
 *     silently booking at a different price.
 *   - Out-of-scope (14+ pax non-DMZ, >28 pax DMZ, Solati under min-hours)
 *     → 422 with contact email. NO DB write, NO Slack, NO email pipe (per
 *     spin-off D4/D19: real frequency is near-zero and the old workflow was
 *     the source of the ops pain).
 *   - Service-role Supabase client — guest checkout (D5 no-auth).
 */

interface BookBody {
  poi_keys?: unknown;
  region?: unknown;
  track?: unknown;
  guide_language?: unknown;
  duration_hours?: unknown;
  party_size?: unknown;
  jeju_pickup_zone?: unknown;
  cruise_port?: unknown;
  requested_date?: unknown;
  contact_email?: unknown;
  contact_name?: unknown;
  contact_phone?: unknown;
  language?: unknown;
  notes?: unknown;
  locale?: unknown;
  source_url?: unknown;
  /** What the client showed the user. Server rejects if it disagrees. */
  client_quoted_total?: unknown;
}

const PICKUP_ZONES: JejuPickupZone[] = ["city", "north", "outer", "cross_island"];
const OUT_OF_SCOPE_CONTACT_EMAIL = "contact@atockorea.com";

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function badRequest(field: string, why: string) {
  return NextResponse.json({ ok: false, error: `${field}: ${why}` }, { status: 400 });
}

export async function POST(request: Request) {
  let body: BookBody;
  try {
    body = (await request.json()) as BookBody;
  } catch {
    return badRequest("body", "not valid JSON");
  }

  // ── Required field validation ────────────────────────────────────────────
  const region = typeof body.region === "string" ? body.region : "";
  if (!isRegionSlug(region)) return badRequest("region", "must be 'busan', 'jeju', or 'seoul'");

  const track = typeof body.track === "string" ? body.track : "";
  if (track !== "private" && track !== "cruise" && track !== "dmz") {
    return badRequest("track", "must be 'private', 'cruise', or 'dmz'");
  }

  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  if (!isEmail(contactEmail)) return badRequest("contact_email", "must be a valid email");

  const requestedDate =
    typeof body.requested_date === "string" && body.requested_date.trim()
      ? body.requested_date.trim()
      : null;
  if (!requestedDate) return badRequest("requested_date", "must be set");

  const poiKeysRaw = Array.isArray(body.poi_keys) ? body.poi_keys : [];
  const poiKeys: string[] = poiKeysRaw
    .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    .slice(0, 30);
  if (track !== "dmz" && poiKeys.length === 0) {
    return badRequest("poi_keys", "must include at least 1 stop");
  }

  // ── Optional fields with safe defaults ───────────────────────────────────
  const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : null;
  const contactPhone = typeof body.contact_phone === "string" ? body.contact_phone.trim() : null;
  const partySize =
    typeof body.party_size === "number" && Number.isFinite(body.party_size) && body.party_size > 0
      ? Math.round(body.party_size)
      : 2;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const locale = typeof body.locale === "string" ? body.locale : null;
  const sourceUrl = typeof body.source_url === "string" ? body.source_url : null;

  const guideLanguage =
    (typeof body.guide_language === "string" && body.guide_language.trim()) ||
    (typeof body.language === "string" && body.language.trim()) ||
    locale ||
    "en";
  const tier = tierForLocale(guideLanguage);

  const durationHours =
    typeof body.duration_hours === "number" && Number.isFinite(body.duration_hours) && body.duration_hours > 0
      ? Math.round(body.duration_hours)
      : track === "dmz"
        ? 0
        : 8;

  const jejuPickupZone =
    typeof body.jeju_pickup_zone === "string" &&
    PICKUP_ZONES.includes(body.jeju_pickup_zone as JejuPickupZone)
      ? (body.jeju_pickup_zone as JejuPickupZone)
      : null;

  const cruisePort =
    body.cruise_port === "gangjeong" || body.cruise_port === "jeju_port"
      ? (body.cruise_port as "gangjeong" | "jeju_port")
      : null;

  const clientQuotedTotal =
    typeof body.client_quoted_total === "number" && Number.isFinite(body.client_quoted_total)
      ? Math.round(body.client_quoted_total)
      : null;

  const supabase = createServerClient();

  // ── Fetch POI region tags + coords (for sub-region + Jeju-cross surcharge)
  let poiRegions: string[] = [];
  let jejuPoiZones: ReturnType<typeof jejuZone>[] | undefined;
  if (poiKeys.length > 0) {
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, region, lat, lng")
      .in("poi_key", poiKeys);
    const poiByKey = new Map(
      (poiRows ?? []).map((r) => [
        r.poi_key as string,
        {
          region: (r.region as string) ?? "",
          lat: Number(r.lat),
          lng: Number(r.lng),
        },
      ]),
    );
    const orderedPois = poiKeys
      .map((k) => poiByKey.get(k))
      .filter((p): p is NonNullable<typeof p> => !!p);
    poiRegions = orderedPois.map((p) => p.region);
    if (region === "jeju") jejuPoiZones = orderedPois.map((p) => jejuZone(p.lat, p.lng));
  }

  // ── Authoritative price recompute ────────────────────────────────────────
  const priceInput: PriceInput = {
    track: track as PricingTrack,
    region,
    guideLanguageTier: tier,
    durationHours,
    pax: partySize,
    requestedDate,
    jejuPickupZone,
    cruisePort,
    poiRegions,
    jejuPoiZones,
  };
  const price = quote(priceInput);

  // ── Out-of-scope hard gate (D4/D19) — no DB write, no email pipe ────────
  if (!price.autoQuotable) {
    trackEvent("itinerary_book_out_of_scope_blocked", {
      region,
      track,
      pax: partySize,
      violations: price.violations.join(","),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "out_of_scope",
        violations: price.violations,
        contact_email: OUT_OF_SCOPE_CONTACT_EMAIL,
      },
      { status: 422 },
    );
  }

  // ── Kill-switch (R6) — ops can globally disable auto-booking ────────────
  if (process.env.PRICING_AUTOQUOTE_ENABLED === "false") {
    return NextResponse.json(
      {
        ok: false,
        error: "booking_disabled",
        contact_email: OUT_OF_SCOPE_CONTACT_EMAIL,
      },
      { status: 503 },
    );
  }

  // ── Price-mismatch defense (mirrors /api/bookings/route.ts:298-309) ─────
  if (clientQuotedTotal != null && Math.abs(clientQuotedTotal - price.total) > 1) {
    trackEvent("itinerary_book_price_changed", {
      clientTotal: clientQuotedTotal,
      serverTotal: price.total,
      delta: price.total - clientQuotedTotal,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "price_changed",
        server_total: price.total,
        client_total: clientQuotedTotal,
      },
      { status: 409 },
    );
  }

  // ── Build the row payload via the shared helper (D11/D12/D17/D25) ───────
  const row = createBuilderBooking({
    poiKeys,
    region: region as RegionSlug,
    track: track as PricingTrack,
    durationHours,
    guideLanguage,
    guideLanguageTier: tier,
    jejuPickupZone,
    cruisePort,
    tourDate: requestedDate,
    pax: partySize,
    contact: { name: contactName ?? "", email: contactEmail, phone: contactPhone ?? null },
    notes,
    locale,
    sourceUrl,
    price,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("bookings")
    .insert(row)
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[/api/itinerary/book] insert failed", insertError);
    return NextResponse.json(
      { ok: false, error: "insert_failed", details: insertError?.message ?? null },
      { status: 500 },
    );
  }

  const bookingId = inserted.id as string;

  trackEvent("itinerary_builder_booking_submitted", {
    bookingId,
    region,
    track,
    pax: partySize,
    totalKrw: price.total,
    leadDays: leadDaysFrom(requestedDate),
  });

  return NextResponse.json({
    ok: true,
    booking_id: bookingId,
    total_krw: price.total,
    currency: "krw",
    breakdown: price.lines,
  });
}

/** Days from today (UTC) to the tour date. Used for telemetry; pricing
 *  policy / Stripe checkout do their own lead-time math. */
function leadDaysFrom(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return -1;
  const tour = Date.UTC(y, m - 1, d);
  const today = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  return Math.round((tour - today) / 86400000);
}
