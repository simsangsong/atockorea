import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import {
  mapNestedTourToUsdRow,
  tourListPricesToUsdSync,
} from '@/lib/tour-list-price-usd.server';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';
import {
  buildUserAffinityAnchor,
  pickTourRecommendations,
  type UserSignalEntry,
} from '@/lib/recommendations/tourSimilarity';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

type BookedTourRow = {
  tour_id?: string | null;
  tours?: NestedTour | null;
};

type NestedTour = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  city?: string | null;
  price?: number | string | null;
  original_price?: number | string | null;
  price_currency?: string | null;
  image_url?: string | null;
  duration?: string | null;
};

type WishlistRow = {
  id: string;
  tour_id?: string | null;
  created_at?: string | null;
  tours?: NestedTour | null;
};

type TourRow = NestedTour & {
  translations?: unknown;
  rating?: number | string | null;
  review_count?: number | string | null;
};

function parseLocale(value: string | null): SupportedLocale {
  if (value && SUPPORTED_LOCALES.includes(value as SupportedLocale)) return value as SupportedLocale;
  return 'en';
}

function translatedString(
  translations: unknown,
  locale: SupportedLocale,
  key: string,
  fallback: string | null | undefined,
): string {
  if (translations && typeof translations === 'object') {
    const localeObj = (translations as Record<string, unknown>)[locale];
    if (localeObj && typeof localeObj === 'object') {
      const value = (localeObj as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return fallback ?? '';
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const locale = parseLocale(searchParams.get('locale'));

    const [bookedToursRes, wishlistRes, tourRowsRes, krwPerUsd] = await Promise.all([
      supabase
        .from('bookings')
        .select(`
          tour_id,
          tours (
            id,
            slug,
            title,
            city,
            price,
            original_price,
            price_currency,
            image_url,
            duration
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('wishlist')
        .select(`
          id,
          tour_id,
          created_at,
          tours (
            id,
            slug,
            title,
            city,
            price,
            original_price,
            price_currency,
            image_url,
            duration
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('tours')
        .select(
          'id, slug, title, translations, city, duration, image_url, price, original_price, price_currency, rating, review_count',
        )
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(50),
      getKrwPerUsd(),
    ]);

    if (bookedToursRes.error) throw bookedToursRes.error;
    if (wishlistRes.error) throw wishlistRes.error;
    if (tourRowsRes.error) throw tourRowsRes.error;

    const bookedTourRows = (bookedToursRes.data ?? []) as BookedTourRow[];
    const wishlistData = ((wishlistRes.data ?? []) as WishlistRow[]).map((row) =>
      mapNestedTourToUsdRow(row, krwPerUsd),
    );
    const tourRows = (tourRowsRes.data ?? []) as TourRow[];

    const bookedTourIds = new Set<string>(
      bookedTourRows.map((b) => String(b.tour_id ?? '')).filter(Boolean),
    );
    const wishlistTourIds = new Set<string>(
      wishlistData.map((w) => String(w.tour_id ?? '')).filter(Boolean),
    );

    const recommendationPool = tourRows
      .filter((tour) => !isTourRowHiddenFromPublicTourApi({ id: String(tour.id ?? ''), slug: tour.slug ?? null }))
      .map((tour) => {
        const { priceUsd } = tourListPricesToUsdSync(
          {
            price: tour.price,
            original_price: tour.original_price,
            price_currency: tour.price_currency,
          },
          krwPerUsd,
        );
        return {
          id: String(tour.id),
          slug: tour.slug ?? null,
          title: translatedString(tour.translations, locale, 'title', tour.title) || 'Tour',
          image: tour.image_url ?? null,
          city: tour.city ?? null,
          duration: translatedString(tour.translations, locale, 'duration', tour.duration) || null,
          price: priceUsd,
          rating: typeof tour.rating === 'number' ? tour.rating : Number(tour.rating ?? 0),
          reviewCount: Number(tour.review_count ?? 0),
        };
      });

    const pricedRecommendationPool = recommendationPool.filter((tour) => {
      return typeof tour.price === 'number' && Number.isFinite(tour.price) && tour.price > 0;
    });

    // Derive user affinity signal from booked + wishlisted tours so the
    // recommendation strip reflects what the user has actually shown interest
    // in (city / duration / price band). Falls back to popularity ranking
    // (already the order of pricedRecommendationPool) when there is no signal.
    const signalEntries: UserSignalEntry[] = [
      ...bookedTourRows.map((b) => {
        const t = b.tours ?? null;
        const { priceUsd } = t
          ? tourListPricesToUsdSync(
              { price: t.price, original_price: t.original_price, price_currency: t.price_currency },
              krwPerUsd,
            )
          : { priceUsd: 0 };
        return {
          city: t?.city ?? null,
          region: t?.city ?? null,
          duration: t?.duration ?? null,
          listPriceUsd: priceUsd,
        };
      }),
      ...wishlistData.map((w) => ({
        city: w.tours?.city ?? null,
        region: w.tours?.city ?? null,
        duration: w.tours?.duration ?? null,
        listPriceUsd: typeof w.tours?.price === 'number' ? w.tours.price : 0,
      })),
    ];
    const affinityAnchor = buildUserAffinityAnchor(signalEntries);

    const eligiblePool = pricedRecommendationPool.filter(
      (tour) => !bookedTourIds.has(tour.id) && !wishlistTourIds.has(tour.id),
    );

    let scoredRecommendations = eligiblePool;
    if (affinityAnchor) {
      const candidates = eligiblePool.map((tour) => ({
        slug: tour.slug ?? tour.id,
        region: tour.city ?? '',
        duration: tour.duration ?? '',
        listPriceUsd: tour.price,
        rating: tour.rating,
        reviewCount: tour.reviewCount,
        _row: tour,
      }));
      const picks = pickTourRecommendations(affinityAnchor, candidates, { k: 6 });
      scoredRecommendations = picks.map((p) => p._row);
    }

    const recommendations =
      scoredRecommendations.length >= 3
        ? scoredRecommendations.slice(0, 6)
        : pricedRecommendationPool.slice(0, 6);

    return NextResponse.json(
      {
        wishlistItems: wishlistData.slice(0, 3).map((w) => ({
          id: w.id,
          tour_id: w.tour_id,
          title: w.tours?.title ?? 'Tour',
          slug: w.tours?.slug ?? null,
          city: w.tours?.city ?? null,
          duration: w.tours?.duration ?? null,
          image_url: w.tours?.image_url ?? null,
          price: typeof w.tours?.price === 'number' ? w.tours.price : null,
          original_price: typeof w.tours?.original_price === 'number' ? w.tours.original_price : null,
        })),
        recommendations,
      },
      { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[api/mypage/extras] failed', error);
    return NextResponse.json({ error: 'Failed to load mypage extras' }, { status: 500 });
  }
}
