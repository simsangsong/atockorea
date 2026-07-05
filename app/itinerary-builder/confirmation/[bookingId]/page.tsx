import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin, ShieldCheck, Wallet, ArrowRight } from "lucide-react";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { createServerClient } from "@/lib/supabase";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { cn } from "@/lib/utils";
import type { PriceLine } from "@/lib/quote-engine/pricing-policy";
import { formatPriceLineLabel } from "@/lib/quote-engine/price-line-labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Itinerary confirmed | AtoC Korea",
  description: "Your custom itinerary is confirmed. Card saved securely; captured on tour day.",
};

interface ItineraryPayload {
  poi_keys?: string[];
  region?: string;
  track?: string;
  duration_hours?: number;
  guide_language?: string;
  breakdown?: PriceLine[];
}

const KRW = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

/**
 * Itinerary-builder confirmation page (Phase 10.5c).
 *
 * Customer lands here after Stripe Elements success on the checkout page.
 * Server fetches the booking + POI names + renders a premium "확정"
 * hero with the stop strip + breakdown + reassurance copy.
 *
 * The Stripe webhook (Phase 2b dispatch arm) fires the confirmation email
 * shortly after — this page is the immediate post-checkout reassurance.
 */
export default async function ItineraryBuilderConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  // NOTE (2026-07-05): confirmation is deliberately NOT gated on
  // ITINERARY_BUILDER_ENABLED — transactional endpoint for completed
  // checkouts (incl. the chatbot funnel), not discoverable builder UI.
  // The 6/29 gate here broke the post-payment page along with checkout.
  const { bookingId } = await params;
  if (!bookingId) notFound();

  const supabase = createServerClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, source, status, payment_intent_status, final_price, currency, tour_date, number_of_guests, contact_name, contact_email, booking_reference, itinerary",
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking || booking.source !== "itinerary_builder") {
    notFound();
  }

  const itinerary = (booking.itinerary as ItineraryPayload | null) ?? {};
  const ref = (booking.booking_reference as string | null) ?? bookingId.slice(0, 8).toUpperCase();
  const tourDate = (booking.tour_date as string | null) ?? "—";
  const guests = (booking.number_of_guests as number | null) ?? 1;
  const total = Math.round(Number(booking.final_price));
  const breakdown = itinerary.breakdown ?? [];
  const region = itinerary.region ?? "korea";

  /**
   * Phase 10.5.1 audit fix — gate the "Confirmed" hero on the actual
   * payment_intent_status. Between Stripe Elements success and the
   * `payment_intent.amount_capturable_updated` webhook there is a brief
   * window (typically <2s, longer under load) where `status` is still
   * `pending`. Showing a green ✓ Confirmed during that window misleads
   * the customer and the email "is on its way" line lies (the webhook
   * sends the email).
   */
  const paymentStatus = (booking.payment_intent_status as string | null) ?? null;
  const isAuthorized =
    paymentStatus === "authorized" ||
    paymentStatus === "captured" ||
    paymentStatus === "setup_pending_hold" ||
    booking.status === "confirmed";

  // Stop strip — fetch POI names for the cart sequence.
  let stops: { poi_key: string; name: string; image: string | null }[] = [];
  if (itinerary.poi_keys && itinerary.poi_keys.length > 0) {
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, name_en, name_ko, default_image_url")
      .in("poi_key", itinerary.poi_keys);
    const byKey = new Map((poiRows ?? []).map((r) => [r.poi_key as string, r]));
    stops = itinerary.poi_keys.map((k) => {
      const row = byKey.get(k);
      return {
        poi_key: k,
        name: (row?.name_ko as string) ?? (row?.name_en as string) ?? k,
        image: (row?.default_image_url as string) ?? null,
      };
    });
  }

  const trackLabel =
    itinerary.track === "cruise"
      ? "Cruise shore excursion"
      : itinerary.track === "dmz"
        ? "DMZ private tour"
        : "Private day trip";

  return (
    <SitePageShell>
      <main className="min-h-screen bg-stone-50">
        <section className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16 lg:px-8">
          {/* Hero — confirmed badge + booking reference (status-gated) */}
          <div className="rounded-card bg-emerald-50/30 ring-1 ring-emerald-100/40 p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_24px_56px_-22px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] md:p-9">
            {isAuthorized ? (
              <>
                <p className="mb-2 inline-flex items-center gap-1.5 text-eyebrow text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  확정되었습니다 · Confirmed
                </p>
                <h1 className="text-h3 font-bold tracking-tight text-slate-900 md:text-h2">
                  Your {trackLabel.toLowerCase()} in {region.charAt(0).toUpperCase() + region.slice(1)} is set
                </h1>
                <p className="mt-2 text-body leading-relaxed text-slate-600">
                  Card saved securely — no charge today. We&apos;ll capture {KRW(total)} at 10:00 AM
                  Korea time on the tour date. Free cancellation up to 24 hours before departure.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 inline-flex items-center gap-1.5 text-eyebrow text-slate-500">
                  <Clock className="h-4 w-4 text-emerald-600" strokeWidth={2.25} aria-hidden />
                  처리 중 · Processing
                </p>
                <h1 className="text-h3 font-bold tracking-tight text-slate-900 md:text-h2">
                  Almost there — finishing your reservation
                </h1>
                <p className="mt-2 text-body leading-relaxed text-slate-600">
                  Stripe accepted your card; we&rsquo;re syncing the booking now. A confirmation
                  email arrives once the card hold is registered (usually a few seconds). You can
                  safely close this tab — the email will reach you either way.
                </p>
              </>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-button bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:grid-cols-3">
              <div>
                <dt className="text-micro font-semibold uppercase tracking-wider text-slate-500">
                  Booking
                </dt>
                <dd className="mt-0.5 text-caption font-bold tabular-nums text-slate-900">{ref}</dd>
              </div>
              <div>
                <dt className="text-micro font-semibold uppercase tracking-wider text-slate-500">
                  Tour date
                </dt>
                <dd className="mt-0.5 text-caption font-bold tabular-nums text-slate-900">{tourDate}</dd>
              </div>
              <div>
                <dt className="text-micro font-semibold uppercase tracking-wider text-slate-500">
                  Guests
                </dt>
                <dd className="mt-0.5 text-caption font-bold tabular-nums text-slate-900">{guests}</dd>
              </div>
            </dl>
          </div>

          {/* Itinerary stop strip */}
          {stops.length > 0 ? (
            <div className="mt-5 rounded-card bg-emerald-50/25 ring-1 ring-emerald-100/40 p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_18px_40px_-18px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]">
              <p className="mb-3 inline-flex items-center gap-1.5 text-eyebrow text-slate-500">
                <MapPin className="h-3 w-3 text-emerald-600" aria-hidden />
                Your day
              </p>
              <ol className="space-y-2">
                {stops.map((s, i) => (
                  <li key={s.poi_key} className="flex items-center gap-3 rounded-button bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold tabular-nums text-emerald-800">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.image ? (
                      <span className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-caption font-semibold text-slate-800">
                      {s.name}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Price breakdown */}
          {breakdown.length > 0 ? (
            <div className="mt-5 rounded-card bg-emerald-50/25 ring-1 ring-emerald-100/40 p-5 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_18px_40px_-18px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]">
              <p className="mb-3 text-eyebrow text-slate-500">Breakdown</p>
              <ul className="space-y-1.5">
                {breakdown.map((line) => (
                  <li
                    key={line.code}
                    className="flex items-baseline justify-between gap-3 text-caption text-slate-700"
                  >
                    <span>{formatPriceLineLabel(line)}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{KRW(line.amount)}</span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 border-t border-emerald-200/40 pt-2.5 text-caption font-bold text-slate-900">
                  <span>Total</span>
                  <span className="text-h3 tabular-nums">{KRW(total)}</span>
                </li>
              </ul>
            </div>
          ) : null}

          {/* Reassurance row */}
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-button bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              Card saved securely
            </span>
            <span aria-hidden className="h-3 w-px bg-emerald-700/20" />
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-emerald-700">
              <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              Charged on tour day
            </span>
            <span aria-hidden className="h-3 w-px bg-emerald-700/20" />
            <span className="text-caption font-semibold text-slate-700">
              24h free cancellation
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-2 md:flex-row md:gap-3">
            <Link
              href="/mypage/upcoming"
              className={cn(homeBtnPrimary, "group inline-flex items-center justify-center gap-2 shadow-md hover:gap-3 md:!w-auto md:!px-6")}
            >
              View in My Page
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/itinerary-builder"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_6px_-2px_rgba(15,23,42,0.10)] transition-all hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_18px_-4px_rgba(15,23,42,0.14)]"
            >
              Plan another trip
            </Link>
          </div>

          <p className="mt-6 text-center text-micro text-slate-500">
            A confirmation email is on its way to{" "}
            <strong className="text-slate-700">{booking.contact_email as string}</strong>.
          </p>
        </section>
      </main>
    </SitePageShell>
  );
}
