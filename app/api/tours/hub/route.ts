import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler } from '@/lib/error-handler';

export interface HubTourItem {
  id: string;
  title: string;
  city: string;
  price: number;
  badges: string[];
  rating: number;
  reviewCount: number;
  slug: string | null;
  imageUrl: string | null;
  duration: string | null;
  highlight: string | null;
}

export interface ToursHubData {
  topPicks: HubTourItem[];
  jeju: HubTourItem[];
  busan: HubTourItem[];
  seoul: HubTourItem[];
  cruise: HubTourItem[];
  heritage: HubTourItem[];
  seasonal: HubTourItem[];
  private: HubTourItem[];
  counts: { jeju: number; busan: number; seoul: number; total: number };
}

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

function toItem(row: Record<string, unknown>): HubTourItem {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    city: String(row.city ?? ''),
    price: Number(row.price ?? 0),
    badges: toBadges(row.badges),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    slug: row.slug ? String(row.slug) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    duration: row.duration ? String(row.duration) : null,
    highlight: row.highlight ? String(row.highlight) : null,
  };
}

export const GET = withErrorHandler(async () => {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('tours')
    .select('id, title, city, price, badges, rating, review_count, slug, image_url, duration, highlight')
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const all = rows.map(toItem);

  const byCity = (city: string) =>
    all.filter((t) => t.city.toLowerCase() === city.toLowerCase());

  const jeju = byCity('Jeju');
  const busan = byCity('Busan');
  const seoul = byCity('Seoul');

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
      hasBadge(t.badges, 'UNESCO', 'heritage', 'national museum', 'gyeongju') ||
      matchesTitle(t.title, 'UNESCO', 'gyeongju', 'heritage'),
  );

  const seasonal = all.filter(
    (t) =>
      hasBadge(t.badges, 'seasonal', 'summer only', 'hydrangea', 'winter', 'festival', 'spring') ||
      matchesTitle(t.title, 'hydrangea', 'winter', 'festival', 'seasonal'),
  );

  const privateTours = all.filter(
    (t) =>
      hasBadge(t.badges, 'private tour', 'private') ||
      matchesTitle(t.title, 'private', 'charter'),
  );

  const hub: ToursHubData = {
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

  return NextResponse.json(hub, {
    headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300' },
  });
});
