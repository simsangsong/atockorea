import React from 'react';
import { createServerClient } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { ToursHubHero } from '@/components/tours-hub/ToursHubHero';
import { TourCollectionStrip } from '@/components/tours-hub/TourCollectionStrip';
import { DestinationGrid } from '@/components/tours-hub/DestinationGrid';
import type { HubTourItem } from '@/app/api/tours/hub/route';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';

// Revalidate every 5 minutes — tour catalogue changes infrequently.
export const revalidate = 300;

// ─── data helpers ────────────────────────────────────────────────────────────

function toBadges(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

function hasBadge(badges: string[], ...keywords: string[]): boolean {
  return badges.some((b) =>
    keywords.some((kw) => b.toLowerCase().includes(kw.toLowerCase())),
  );
}

function matchesTitle(title: string, ...keywords: string[]): boolean {
  return keywords.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
}

interface RawTourRow {
  id: string;
  title: string;
  city: string;
  price: string | number;
  badges: unknown;
  rating: string | number;
  review_count: number;
  slug: string | null;
  image_url: string | null;
  duration: string | null;
  highlight: string | null;
}

function toItem(row: RawTourRow): HubTourItem {
  return {
    id: String(row.id),
    title: String(row.title),
    city: String(row.city),
    price: Number(row.price ?? 0),
    badges: toBadges(row.badges),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    slug: row.slug ?? null,
    imageUrl: row.image_url ?? null,
    duration: row.duration ?? null,
    highlight: row.highlight ?? null,
  };
}

const MAX_SECTION_TOURS = 6;

function takeSection(tours: HubTourItem[]): HubTourItem[] {
  return tours.slice(0, MAX_SECTION_TOURS);
}

const fetchHubData = unstable_cache(async () => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('tours')
    .select(
      'id, title, city, price, badges, rating, review_count, slug, image_url, duration, highlight',
    )
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error || !data) return null;

  const all = (data as RawTourRow[]).map(toItem);

  const byCity = (city: string) =>
    all.filter((t) => t.city.toLowerCase() === city.toLowerCase());

  const jeju = byCity('jeju');
  const busan = byCity('busan');
  const seoul = byCity('seoul');

  const topPicks = all
    .filter((t) => t.rating >= 4.7 && t.reviewCount > 0 && t.price > 0)
    .slice(0, 6);

  const cruise = all.filter(
    (t) =>
      hasBadge(t.badges, 'cruise') ||
      matchesTitle(t.title, 'cruise', 'shore excursion'),
  );

  const heritage = all.filter(
    (t) =>
      hasBadge(t.badges, 'unesco', 'heritage', 'national museum', 'gyeongju') ||
      matchesTitle(t.title, 'unesco', 'gyeongju', 'heritage'),
  );

  const seasonal = all.filter(
    (t) =>
      hasBadge(t.badges, 'seasonal', 'summer only', 'hydrangea', 'winter', 'festival') ||
      matchesTitle(t.title, 'hydrangea', 'winter', 'festival', 'seasonal'),
  );

  // Per D7 2026-05-17 (itinerary-builder planner): the "Private & Charter Tours"
  // section is removed from the hub. Pure private-tour landings live in the
  // catalogue (still bookable via /tour-product/<slug>); the canonical entry
  // for custom itineraries is now /itinerary-builder. Cruise+private overlap
  // tours stay surfaced under the cruise section.

  return {
    topPicks,
    jeju: takeSection(jeju),
    busan: takeSection(busan),
    seoul: takeSection(seoul),
    cruise: takeSection(cruise),
    heritage: takeSection(heritage),
    seasonal: takeSection(seasonal),
    counts: {
      jeju: jeju.length,
      busan: busan.length,
      seoul: seoul.length,
      total: all.length,
    },
  };
}, ['tours-hub-page-data-v2'], { revalidate: 300 });

// ─── page ────────────────────────────────────────────────────────────────────

export default async function ToursHubPage() {
  const hub = await fetchHubData();

  return (
    <SitePageShell>
      <main className="min-h-screen bg-gradient-to-b from-[#faf9f7] via-[#fdfcfb] to-white">
        {/* ── Hero ── */}
        <ToursHubHero />

        {/* ── Sections ── */}
        <div className="mx-auto max-w-[1400px] space-y-16 py-12 pb-20 sm:space-y-20">

          {/* Top Picks — house signature, opens the catalogue */}
          {hub && hub.topPicks.length > 0 && (
            <TourCollectionStrip
              eyebrow="EDITOR'S BEST · THIS SEASON"
              title="Our highest-rated"
              titleAccent="tours of the year."
              editorNote="When ratings, repeat bookings, and our team's own travel notes all align, a tour earns this list. These are the days we'd send our own family on."
              curator="Curated by the AtoC Korea editorial team"
              tours={hub.topPicks}
              seeAllHref="/tours/list?sort=rating"
              seeAllLabel="All top-rated"
              accent="signature"
            />
          )}

          {/* Want a private tour? — magazine-style editorial CTA placed AFTER top picks
              so the dark hero doesn't stack with another dark block. Tone is now
              ivory + amber line accent + serif accent (matches strip header language). */}
          <Link
            href="/itinerary-builder"
            className="group relative mx-4 block overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-[#fdfaf3] via-[#fbf6ea] to-[#f8efdb] px-6 py-8 shadow-[0_18px_48px_-22px_rgba(146,64,14,0.28)] ring-1 ring-amber-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_64px_-24px_rgba(146,64,14,0.36)] sm:mx-6 md:px-10 md:py-10 lg:mx-8"
          >
            <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px w-10 shrink-0 rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700" aria-hidden />
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-amber-800">
                    A different way to travel · Private
                  </span>
                </div>
                <h2 className="text-[24px] font-bold leading-[1.12] tracking-[-0.025em] text-slate-900 md:text-[28px]">
                  Build your own day on the map —{' '}
                  <span className="font-serif italic font-medium text-amber-800">Busan or Jeju.</span>
                </h2>
                <p className="mt-3 max-w-[58ch] text-[13.5px] leading-[1.6] text-slate-700 md:text-[14.5px]">
                  Skip the package. Pick the stops you actually want, drag them into a sequence,
                  and our Korea team returns a custom itinerary with transparent pricing — usually within a day.
                </p>
                <p className="mt-3 flex items-center gap-2 text-[11.5px] italic text-slate-500">
                  <span className="inline-block h-px w-6 bg-slate-300" aria-hidden />
                  Itinerary desk — open 9–9 KST
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-[13px] font-bold text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.45)] transition-all group-hover:gap-3 group-hover:bg-slate-800">
                Open the map
                <span aria-hidden>→</span>
              </span>
            </div>
          </Link>

          {/* Destination Grid */}
          {hub && (
            <DestinationGrid counts={hub.counts} />
          )}

          {/* Jeju Island — volcanic teal */}
          {hub && hub.jeju.length > 0 && (
            <TourCollectionStrip
              eyebrow="BY ISLAND · JEJU"
              title="Volcanic coast,"
              titleAccent="turquoise sea."
              editorNote="Jeju holds Korea's only UNESCO Triple Crown — volcanic, marine, and lava-tube heritage on one island. Our editors live for the back-roads east coast at sunrise."
              curator="Curated by Min · Lead Jeju editor"
              tours={hub.jeju}
              seeAllHref="/tours/list?destination=Jeju"
              seeAllLabel="All Jeju tours"
              accent="volcano"
            />
          )}

          {/* Busan — harbor indigo */}
          {hub && hub.busan.length > 0 && (
            <TourCollectionStrip
              eyebrow="BY CITY · BUSAN"
              title="Harbor city,"
              titleAccent="hillside villages."
              editorNote="Port-life and temple-time within forty minutes of each other. Our Busan picks are built around the cable-car-to-coast rhythm locals actually use."
              curator="Curated by Eunji · Lead Busan editor"
              tours={hub.busan}
              seeAllHref="/tours/list?destination=Busan"
              seeAllLabel="All Busan tours"
              accent="harbor"
            />
          )}

          {/* Seoul & Day Trips — palace plum */}
          {hub && hub.seoul.length > 0 && (
            <TourCollectionStrip
              eyebrow="BY CAPITAL · SEOUL & DAY TRIPS"
              title="Palaces, hanok villages,"
              titleAccent="& quiet countryside."
              editorNote="Seoul rewards travelers who pace themselves. We curate day trips that pair palace mornings with countryside afternoons — no rushed two-stop sprints."
              curator="Curated by Jaewon · Lead Seoul editor"
              tours={hub.seoul}
              seeAllHref="/tours/list?destination=Seoul"
              seeAllLabel="All Seoul tours"
              accent="palace"
            />
          )}

          {/* Cruise — deep ocean */}
          {hub && hub.cruise.length > 0 && (
            <div className="space-y-5">
              <TourCollectionStrip
                eyebrow="CRUISE-PORT TOURS · GUARANTEED RETURN"
                title="Tours timed"
                titleAccent="to your ship."
                editorNote="Every cruise excursion here is built around your port hours, with onshore contingency time and ship-side return guarantees. No second-guessing the clock."
                curator="Curated by the cruise desk"
                tours={hub.cruise}
                seeAllHref="/tours/list?features=Cruise+excursion"
                seeAllLabel="All cruise tours"
                accent="ocean"
              />
              {/* Inline match CTA inside cruise — per D7: cruise guests get matched
                  via the same itinerary builder (cruise track will branch in Phase 4). */}
              <div className="mx-4 rounded-2xl border border-sky-200/60 bg-sky-50/70 px-5 py-4 ring-1 ring-sky-100/50 sm:mx-6 md:flex md:items-center md:justify-between lg:mx-8">
                <p className="text-[13.5px] text-slate-700 md:text-sm">
                  <span className="font-semibold text-slate-900">On a cruise?</span>{" "}
                  Tell us your port + hours and we&apos;ll match an itinerary that gets you back to the ship.
                </p>
                <Link
                  href="/itinerary-builder"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-800 hover:text-sky-900 md:mt-0"
                >
                  Match a cruise itinerary →
                </Link>
              </div>
            </div>
          )}

          {/* UNESCO & Heritage — oxblood */}
          {hub && hub.heritage.length > 0 && (
            <TourCollectionStrip
              eyebrow="UNESCO & HERITAGE"
              title="Thousand-year temples,"
              titleAccent="living traditions."
              editorNote="Korea's World Heritage sites are still functioning places of practice, not museum pieces. These tours go in with monks, weavers, and guardians who know each stone."
              curator="Curated by the heritage desk"
              tours={hub.heritage}
              seeAllHref="/tours/list?features=UNESCO"
              seeAllLabel="All heritage tours"
              accent="temple"
            />
          )}

          {/* Seasonal — cherry blush */}
          {hub && hub.seasonal.length > 0 && (
            <TourCollectionStrip
              eyebrow="IN SEASON · LIMITED RUN"
              title="Cherry blossoms,"
              titleAccent="hydrangea, & snow."
              editorNote="A handful of tours that exist only for a few weeks each year. Once the petals drop or the snow clears, these dates close. We refresh the lineup every season."
              curator="Curated by the seasonal desk"
              tours={hub.seasonal}
              seeAllHref="/tours/list"
              seeAllLabel="Browse all"
              accent="blossom"
            />
          )}

          {/* Browse All CTA */}
          <div className="flex flex-col items-center gap-4 px-4 py-6 text-center">
            <p className="text-[11.5px] italic text-slate-500">
              <span className="inline-block h-px w-6 bg-slate-300 align-middle" aria-hidden />{' '}
              {hub ? `${hub.counts.total} curated tours, all reviewed by our Korea team` : 'Curated by our Korea team'}
            </p>
            <Link
              href="/tours/list"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-[13.5px] font-bold text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.45)] transition-all duration-200 hover:bg-slate-800 hover:gap-3 hover:shadow-[0_18px_36px_-14px_rgba(15,23,42,0.5)]"
            >
              Browse the full catalogue
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
