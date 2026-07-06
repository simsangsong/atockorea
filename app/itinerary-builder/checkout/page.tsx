import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { createServerClient } from "@/lib/supabase";
import { quote, tierForLocale, jejuZone, type CruisePort, type JejuPickupZone, type PriceInput, type PricingTrack } from "@/lib/quote-engine/pricing-policy";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import LivePriceCard from "@/components/itinerary-builder/LivePriceCard";
import CheckoutCardClient from "@/components/itinerary-builder/CheckoutCardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your itinerary | AtoC Korea",
  description: "Save your card securely — no charge today, captured on tour day.",
};

interface ItineraryPayload {
  poi_keys?: string[];
  region?: RegionSlug;
  track?: PricingTrack;
  duration_hours?: number;
  guide_language?: string;
  jeju_pickup_zone?: JejuPickupZone | null;
  cruise_port?: CruisePort | null;
}

/**
 * Itinerary-builder checkout (Phase 10.5b).
 *
 * URL-only handoff per D10: read `?bookingId=` server-side, fetch the
 * row, verify `source='itinerary_builder'`, hand off to the client card
 * component which calls `/api/stripe/checkout` for the PI/SI clientSecret
 * and renders the same `<NoShowHoldCardForm>` the tour-product flow uses
 * (currency='krw' branch from Phase 10.2 D23).
 *
 * Side panel renders the LivePriceCard (compact) + itinerary stop strip
 * so the customer can sanity-check what they're paying for before adding
 * the card.
 */
export default async function ItineraryBuilderCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  // NOTE (2026-07-05): checkout is deliberately NOT gated on
  // ITINERARY_BUILDER_ENABLED. The Klook-prep gate (6/29) accidentally locked
  // this page too, silently killing the CHATBOT quote funnel's payment
  // hand-off for a week (the bot's checkout link client-redirected to
  // /tours/list). This page is a transactional endpoint reached only via a
  // bookingId deep-link — it is not discoverable builder UI.
  const sp = await searchParams;
  const bookingId = typeof sp.bookingId === "string" ? sp.bookingId.trim() : "";
  if (!bookingId) notFound();

  const supabase = createServerClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, source, status, final_price, currency, tour_date, number_of_guests, contact_name, contact_email, contact_phone, booking_reference, itinerary",
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking || booking.source !== "itinerary_builder") {
    notFound();
  }

  // Deep-audit 2026-07-05: a stale checkout deep-link for a no-longer-chargeable
  // booking should not render the card form (the API also 409s, but bounce the
  // page early so the customer isn't shown a dead form). `pending` and
  // `confirmed` both stay — confirmed lets a customer re-open before capture.
  const bookingStatus = (booking as { status?: string | null }).status ?? "";
  if (["cancelled", "completed", "no_show", "refunded", "expired"].includes(bookingStatus)) {
    redirect("/tours/list");
  }

  const itinerary = (booking.itinerary as ItineraryPayload | null) ?? {};
  const region: RegionSlug = (itinerary.region as RegionSlug) ?? "busan";
  const track: PricingTrack = (itinerary.track as PricingTrack) ?? "private";

  // Re-compute the live price for the side panel so the customer sees the
  // same breakdown the planner showed (driven from itinerary jsonb, not the
  // raw final_price scalar).
  let poiRegions: string[] = [];
  let jejuPoiZones: ReturnType<typeof jejuZone>[] | undefined;
  if (itinerary.poi_keys && itinerary.poi_keys.length > 0) {
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, region, lat, lng, name_en, name_ko, default_image_url")
      .in("poi_key", itinerary.poi_keys);
    const byKey = new Map((poiRows ?? []).map((r) => [r.poi_key as string, r]));
    const ordered = itinerary.poi_keys.map((k) => byKey.get(k)).filter(Boolean);
    poiRegions = ordered.map((p) => (p?.region as string) ?? "");
    if (region === "jeju") {
      jejuPoiZones = ordered.map((p) =>
        p ? jejuZone(Number(p.lat), Number(p.lng)) : ("city" as ReturnType<typeof jejuZone>),
      );
    }
  }

  const priceInput: PriceInput = {
    track,
    region,
    guideLanguageTier: tierForLocale(itinerary.guide_language ?? "en"),
    durationHours: itinerary.duration_hours ?? 8,
    pax: booking.number_of_guests ?? 2,
    requestedDate: (booking.tour_date as string | null) ?? null,
    jejuPickupZone: itinerary.jeju_pickup_zone ?? null,
    cruisePort: itinerary.cruise_port ?? null,
    poiRegions,
    jejuPoiZones,
  };
  const price = quote(priceInput);

  // POI thumbs for the side-panel summary (re-fetched lightly).
  let poiThumbs: { poi_key: string; name: string; image: string | null }[] = [];
  if (itinerary.poi_keys && itinerary.poi_keys.length > 0) {
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, name_en, name_ko, default_image_url")
      .in("poi_key", itinerary.poi_keys);
    const byKey = new Map((poiRows ?? []).map((r) => [r.poi_key as string, r]));
    poiThumbs = itinerary.poi_keys.map((k) => {
      const row = byKey.get(k);
      return {
        poi_key: k,
        name: (row?.name_ko as string) ?? (row?.name_en as string) ?? k,
        image: (row?.default_image_url as string) ?? null,
      };
    });
  }

  return (
    <SitePageShell>
      <main className="min-h-screen bg-stone-50">
        <nav
          aria-label="Checkout navigation"
          className="border-b border-slate-200/70 bg-white/80 backdrop-blur"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
            <Link
              href={`/itinerary-builder?region=${region}`}
              className="inline-flex items-center gap-1 text-micro font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Back to planner
            </Link>
            <div className="text-right">
              <p className="text-caption font-semibold text-slate-900">Confirm your itinerary</p>
              <p className="mt-0.5 text-micro text-slate-500">
                Booking {(booking.booking_reference as string | null) ?? bookingId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </nav>

        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card form (lg: 2 cols) */}
            <div className="lg:col-span-2">
              <div className="rounded-card bg-emerald-50/30 ring-1 ring-emerald-100/40 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.9)] md:p-7">
                <CheckoutCardClient
                  bookingId={bookingId}
                  currency={(booking.currency as "krw" | "usd") ?? "krw"}
                  amountMinor={Math.round(Number(booking.final_price))}
                  contactEmail={(booking.contact_email as string | null) ?? null}
                  contactName={(booking.contact_name as string | null) ?? null}
                  contactPhone={(booking.contact_phone as string | null) ?? null}
                />
              </div>
            </div>

            {/* Side summary (lg: 1 col, sticky) */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="space-y-4">
                <LivePriceCard price={price} isJeju={region === "jeju"} compact />
                {poiThumbs.length > 0 ? (
                  <div className="rounded-card bg-emerald-50/25 ring-1 ring-emerald-100/40 px-3.5 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <p className="mb-2 text-micro font-semibold uppercase tracking-wider text-slate-500">
                      Your itinerary
                    </p>
                    <ol className="space-y-1.5">
                      {poiThumbs.map((p, i) => (
                        <li key={p.poi_key} className="flex items-center gap-2.5 text-caption">
                          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold tabular-nums text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate text-slate-700">{p.name}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
