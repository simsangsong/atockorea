import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import {
  mapNestedTourRowsToUsd,
  tourListPricesToUsdSync,
} from '@/lib/tour-list-price-usd.server';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';

const SUPPORTED_LOCALES = ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

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

    const [bookedToursRes, wishlistRes, tourRowsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('tour_id')
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
        .limit(18),
    ]);

    if (bookedToursRes.error) throw bookedToursRes.error;
    if (wishlistRes.error) throw wishlistRes.error;
    if (tourRowsRes.error) throw tourRowsRes.error;

    const wishlistData = await mapNestedTourRowsToUsd(wishlistRes.data ?? []);
    const bookedTourIds = new Set<string>(
      (bookedToursRes.data ?? []).map((b: any) => String(b.tour_id)).filter(Boolean),
    );
    const wishlistTourIds = new Set<string>(
      wishlistData.map((w: any) => String(w.tour_id)).filter(Boolean),
    );

    const krwPerUsd = await getKrwPerUsd();
    const recommendationPool = (tourRowsRes.data ?? [])
      .filter((tour: any) => !isTourRowHiddenFromPublicTourApi({ id: String(tour.id ?? ''), slug: tour.slug }))
      .map((tour: any) => {
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

    const filteredRecommendations = recommendationPool
      .filter((tour) => !bookedTourIds.has(tour.id) && !wishlistTourIds.has(tour.id))
      .slice(0, 6);
    const recommendations =
      filteredRecommendations.length >= 3 ? filteredRecommendations : recommendationPool.slice(0, 6);

    return NextResponse.json(
      {
        wishlistItems: wishlistData.slice(0, 3).map((w: any) => ({
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
