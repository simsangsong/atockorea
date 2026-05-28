/**
 * Pure helper that builds the `bookings` row payload for an
 * itinerary-builder booking (Phase 10 D11/D12/D17/D25).
 *
 * Inputs: a `PriceResult` from the Phase 9 pricing policy + intake +
 * contact info. The helper does NOT touch Supabase; the caller
 * (`/api/itinerary/book`) performs the INSERT.
 *
 * Discipline:
 *   - `unit_price = total_price = final_price = price.total` (D11 flat-rate)
 *   - `currency = 'krw'`, `source = 'itinerary_builder'` (D16)
 *   - `merchant_id = null` — verified safe (Phase 2 task 2e). Settlement /
 *     /api/admin/orders/[id]/settle never reads merchant_id; merchant portal
 *     queries filter by merchant_id so builder rows correctly stay AtoC-self.
 *   - `booking_reference = 'A2C-' + 8 hex chars` — matches the existing
 *     tour-product pattern (`app/api/bookings/route.ts:314`).
 *   - `itinerary` jsonb mirrors the existing `auto_quote_breakdown` shape
 *     so admin readers can render the same structure (D17).
 */

import type {
  PriceResult,
  PricingTrack,
  PricingRegion,
  GuideLanguageTier,
  JejuPickupZone,
  CruisePort,
  PriceLine,
  VehicleClass,
} from "@/lib/quote-engine/pricing-policy";

export interface BuilderBookingInput {
  /** The cart, in order. */
  poiKeys: string[];
  region: PricingRegion;
  track: PricingTrack;
  durationHours: number;
  /** Locale code of the guide language (en/ja/es/zh/zh-TW/ko). */
  guideLanguage: string;
  /** Guide tier resolved from `guideLanguage` (drives pricing). */
  guideLanguageTier: GuideLanguageTier;
  jejuPickupZone?: JejuPickupZone | null;
  cruisePort?: CruisePort | null;
  /** ISO yyyy-mm-dd. */
  tourDate: string;
  pax: number;
  contact: {
    name: string;
    email: string;
    phone?: string | null;
  };
  notes?: string | null;
  locale?: string | null;
  sourceUrl?: string | null;
  /** Authenticated user id, when available. Builder allows guest checkout (D5). */
  userId?: string | null;
  /** The authoritative server-recomputed price. */
  price: PriceResult;
  /** Override the random booking_reference (testing). */
  bookingReferenceOverride?: string;
}

export interface BuilderBookingRow {
  user_id: string | null;
  tour_id: null;
  merchant_id: null;
  booking_reference: string;
  booking_date: string;
  tour_date: string;
  number_of_guests: number;
  unit_price: number;
  total_price: number;
  final_price: number;
  currency: "krw";
  source: "itinerary_builder";
  payment_method: "pending";
  payment_status: "pending";
  status: "pending";
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_language: string | null;
  special_requests: string | null;
  itinerary: {
    poi_keys: string[];
    region: PricingRegion;
    track: PricingTrack;
    duration_hours: number;
    guide_language: string;
    guide_language_tier: GuideLanguageTier;
    jeju_pickup_zone: JejuPickupZone | null;
    cruise_port: CruisePort | null;
    breakdown: PriceLine[];
    vehicle: VehicleClass;
    tier: GuideLanguageTier;
    peak_season: boolean;
    pax: number;
    locale: string | null;
    source_url: string | null;
    notes: string | null;
  };
}

/** 8-char uppercase hex slug — same shape as `app/api/bookings/route.ts:314`. */
function bookingReferenceSlug(): string {
  // Node's `crypto` is available in Next.js route handlers; in tests it's also
  // available via Node's built-in `crypto` module. Use globalThis to stay
  // isomorphic without importing in this pure helper.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid = c?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `A2C-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function todayYmd(): string {
  // CURRENT_DATE in the bookings table defaults to today; we set it explicitly
  // so the helper is testable without leaning on the DB default.
  return new Date().toISOString().slice(0, 10);
}

function nullable(s: string | null | undefined): string | null {
  const v = typeof s === "string" ? s.trim() : "";
  return v.length > 0 ? v : null;
}

export function createBuilderBooking(input: BuilderBookingInput): BuilderBookingRow {
  const total = Math.round(input.price.total);
  return {
    user_id: input.userId ?? null,
    tour_id: null,
    merchant_id: null,
    booking_reference: input.bookingReferenceOverride ?? bookingReferenceSlug(),
    booking_date: todayYmd(),
    tour_date: input.tourDate,
    number_of_guests: Math.max(1, Math.round(input.pax)),
    /** D11 — flat-rate; three columns hold the same value so legacy BI joins
     *  on `unit_price` get a sensible number. Per-person fiction would corrupt
     *  Solati 10-13 pax reports (one price, many guests). */
    unit_price: total,
    total_price: total,
    final_price: total,
    currency: "krw",
    source: "itinerary_builder",
    payment_method: "pending",
    payment_status: "pending",
    status: "pending",
    contact_name: nullable(input.contact.name),
    contact_email: nullable(input.contact.email),
    contact_phone: nullable(input.contact.phone),
    preferred_language: nullable(input.guideLanguage),
    special_requests: nullable(input.notes),
    itinerary: {
      poi_keys: input.poiKeys,
      region: input.region,
      track: input.track,
      duration_hours: input.durationHours,
      guide_language: input.guideLanguage,
      guide_language_tier: input.guideLanguageTier,
      jeju_pickup_zone: input.jejuPickupZone ?? null,
      cruise_port: input.cruisePort ?? null,
      breakdown: input.price.lines,
      vehicle: input.price.vehicle,
      tier: input.price.tier,
      peak_season: input.price.peakSeason,
      pax: input.pax,
      locale: nullable(input.locale),
      source_url: nullable(input.sourceUrl),
      notes: nullable(input.notes),
    },
  };
}
