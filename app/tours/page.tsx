import React from 'react';
import { createServerClient } from '@/lib/supabase';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { ToursHubHero } from '@/components/tours-hub/ToursHubHero';
import { TourCollectionStrip } from '@/components/tours-hub/TourCollectionStrip';
import { DestinationGrid } from '@/components/tours-hub/DestinationGrid';
import type { HubTourItem } from '@/app/api/tours/hub/route';
import Link from 'next/link';

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

async function fetchHubData() {
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

  const privateTours = all.filter(
    (t) =>
      hasBadge(t.badges, 'private tour', 'private') ||
      matchesTitle(t.title, 'private', 'charter'),
  );

  return {
    topPicks,
    jeju,
    busan,
    seoul,
    cruise,
    heritage,
    seasonal,
    private: privateTours,
    counts: {
      jeju: jeju.length,
      busan: busan.length,
      seoul: seoul.length,
      total: all.length,
    },
  };
}

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
            <TourCollectionStrip
              icon="🚢"
              title="Cruise Shore Excursions"
              subtitle="Port-to-port tours with guaranteed return times — designed for cruise guests"
              tours={hub.cruise}
              seeAllHref="/tours/list?features=Cruise+excursion"
              seeAllLabel="All cruise tours"
              accentColor="blue"
            />
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

          {/* Private & Charter */}
          {hub && hub.private.length > 0 && (
            <TourCollectionStrip
              icon="🚐"
              title="Private & Charter Tours"
              subtitle="Your own vehicle, your own pace — fully customisable itineraries"
              tours={hub.private}
              seeAllHref="/tours/list?type=private"
              seeAllLabel="All private tours"
              accentColor="violet"
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
