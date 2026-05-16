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
      <main className="min-h-screen bg-slate-50">
        {/* ── Hero ── */}
        <ToursHubHero />

        {/* ── Sections ── */}
        <div className="mx-auto max-w-[1400px] space-y-14 py-12 pb-20">

          {/* Want a private tour? — Direct CTA to the itinerary builder.
              Per D7 2026-05-17: legacy /tours/private section removed; users
              wanting custom routes go to /itinerary-builder instead. */}
          <Link
            href="/itinerary-builder"
            className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-6 py-7 shadow-xl ring-1 ring-amber-700/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl md:px-10 md:py-9"
          >
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
                  Want a private tour?
                </p>
                <h2 className="text-xl font-bold leading-tight text-white md:text-2xl">
                  Build your own day on the map — Busan or Jeju
                </h2>
                <p className="mt-2 text-[13.5px] text-slate-300 md:text-[14.5px]">
                  Pick stops you actually want to visit. Drag-to-sequence with a custom quote. No package required.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-[13px] font-bold text-slate-900 shadow-md transition-all group-hover:gap-3 group-hover:bg-amber-300">
                Open the map
                <span aria-hidden>→</span>
              </span>
            </div>
          </Link>

          {/* Top Picks */}
          {hub && hub.topPicks.length > 0 && (
            <TourCollectionStrip
              icon="⭐"
              title="Top Picks"
              subtitle="Highest-rated tours with verified reviews"
              tours={hub.topPicks}
              seeAllHref="/tours/list?sort=rating"
              seeAllLabel="All top-rated"
              accentColor="amber"
            />
          )}

          {/* Destination Grid */}
          {hub && (
            <DestinationGrid counts={hub.counts} />
          )}

          {/* Jeju Island */}
          {hub && hub.jeju.length > 0 && (
            <TourCollectionStrip
              icon="🌋"
              title="Jeju Island Tours"
              subtitle="Korea's volcanic island — UNESCO craters, waterfalls & coastal drives"
              tours={hub.jeju}
              seeAllHref="/tours/list?destination=Jeju"
              seeAllLabel="All Jeju tours"
              accentColor="emerald"
            />
          )}

          {/* Busan Tours */}
          {hub && hub.busan.length > 0 && (
            <TourCollectionStrip
              icon="⚓"
              title="Busan Tours"
              subtitle="Korea's port city — temples, beaches & street food culture"
              tours={hub.busan}
              seeAllHref="/tours/list?destination=Busan"
              seeAllLabel="All Busan tours"
              accentColor="blue"
            />
          )}

          {/* Seoul & Day Trips */}
          {hub && hub.seoul.length > 0 && (
            <TourCollectionStrip
              icon="🏯"
              title="Seoul & Day Trips"
              subtitle="Palaces, hanok villages & countryside escapes from the capital"
              tours={hub.seoul}
              seeAllHref="/tours/list?destination=Seoul"
              seeAllLabel="All Seoul tours"
              accentColor="violet"
            />
          )}

          {/* Cruise Shore Excursions */}
          {hub && hub.cruise.length > 0 && (
            <>
              <TourCollectionStrip
                icon="🚢"
                title="Cruise Shore Excursions"
                subtitle="Port-to-port tours with guaranteed return times — designed for cruise guests"
                tours={hub.cruise}
                seeAllHref="/tours/list?features=Cruise+excursion"
                seeAllLabel="All cruise tours"
                accentColor="blue"
              />
              {/* Inline match CTA inside cruise — per D7: cruise guests get matched
                  via the same itinerary builder (cruise track will branch in Phase 4). */}
              <div className="-mt-6 mx-4 rounded-xl bg-sky-50 px-5 py-4 ring-1 ring-sky-100 md:mx-0 md:flex md:items-center md:justify-between">
                <p className="text-[13.5px] text-slate-700 md:text-sm">
                  <span className="font-semibold text-slate-900">On a cruise?</span>{" "}
                  Tell us your port + hours and we'll match an itinerary that gets you back to the ship.
                </p>
                <Link
                  href="/itinerary-builder"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-700 hover:text-sky-900 md:mt-0"
                >
                  Match a cruise itinerary →
                </Link>
              </div>
            </>
          )}

          {/* UNESCO & Heritage */}
          {hub && hub.heritage.length > 0 && (
            <TourCollectionStrip
              icon="🏛️"
              title="UNESCO & Heritage"
              subtitle="World Heritage sites, ancient capitals & 1,000-year-old temples"
              tours={hub.heritage}
              seeAllHref="/tours/list?features=UNESCO"
              seeAllLabel="All heritage tours"
              accentColor="rose"
            />
          )}

          {/* Seasonal Specials */}
          {hub && hub.seasonal.length > 0 && (
            <TourCollectionStrip
              icon="🌺"
              title="Seasonal Specials"
              subtitle="Limited-season tours — hydrangea festivals, winter landscapes & more"
              tours={hub.seasonal}
              seeAllHref="/tours/list"
              seeAllLabel="Browse all"
              accentColor="rose"
            />
          )}

          {/* Browse All CTA */}
          <div className="flex flex-col items-center gap-3 px-4 py-4 text-center">
            <p className="text-[13px] text-slate-500">
              {hub ? `Showing all ${hub.counts.total} available tours` : 'Browse our full catalogue'}
            </p>
            <Link
              href="/tours/list"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-[13.5px] font-bold text-white shadow-lg transition-all duration-200 hover:bg-slate-800 hover:shadow-xl hover:gap-3"
            >
              Browse All Tours
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </main>
    </SitePageShell>
  );
}
