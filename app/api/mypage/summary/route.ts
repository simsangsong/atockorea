import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { getKrwPerUsd } from '@/lib/exchange/usdBasedRates.server';
import {
  mapNestedTourRowsToUsd,
  tourListPricesToUsdSync,
} from '@/lib/tour-list-price-usd.server';
import { isTourRowHiddenFromPublicTourApi } from '@/lib/tour-consumer-visibility';
import {
  isReviewWriteWindowOpenForViewer,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';

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

    const [profileRes, bookingsRes, reviewsRes, wishlistRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('full_name, phone, birth_year, nationality, language_preference, avatar_url')
        .eq('id', user.id)
        .single(),
      supabase
        .from('bookings')
        .select(`
          id,
          tour_id,
          tour_date,
          booking_date,
          created_at,
          status,
          number_of_guests,
          tours (
            id,
            slug,
            title,
            city,
            image_url
          ),
          pickup_points (
            name,
            pickup_time
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, booking_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
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
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (wishlistRes.error) throw wishlistRes.error;

    const profile = profileRes.data ?? null;
    const bookingsData = bookingsRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const wishlistData = await mapNestedTourRowsToUsd(wishlistRes.data ?? []);
    const reviewedBookingIds = new Set(
      reviews.map((r: { booking_id?: string | null }) => r.booking_id).filter(Boolean),
    );

    const now = new Date();
    const upcomingList = bookingsData
      .filter((b: any) => {
        const tourDate = new Date(b.tour_date || b.booking_date || b.created_at);
        return (b.status === 'confirmed' || b.status === 'pending') && tourDate >= now;
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.tour_date || a.booking_date).getTime();
        const db = new Date(b.tour_date || b.booking_date).getTime();
        return da - db;
      });

    const completedOrCancelled = bookingsData.filter(
      (b: any) => b.status === 'completed' || b.status === 'cancelled',
    );

    const first = upcomingList[0] as any | undefined;
    const nextTrip = first
      ? {
          bookingId: first.id,
          tourId: first.tour_id,
          slug: first.tours?.slug ?? null,
          title: first.tours?.title || 'Tour',
          tourDate: first.tour_date || first.booking_date,
          status: first.status,
          guests: first.number_of_guests ?? null,
          imageUrl: first.tours?.image_url ?? null,
          city: first.tours?.city ?? null,
          pickupName: first.pickup_points?.name ?? null,
          pickupTime: first.pickup_points?.pickup_time ?? null,
        }
      : null;

    const pendingReviews = bookingsData
      .filter((b: any) => {
        if (b.status !== 'completed') return false;
        if (reviewedBookingIds.has(b.id)) return false;
        const ymd = normalizeBookingTourDateYmd(b.tour_date || null);
        return ymd ? isReviewWriteWindowOpenForViewer(ymd, user.email ?? null) : false;
      })
      .slice(0, 5)
      .map((b: any) => ({
        bookingId: b.id,
        tourId: b.tour_id,
        slug: b.tours?.slug ?? null,
        title: b.tours?.title || 'Tour',
      }));

    const bookedTourIds = new Set<string>(
      bookingsData.map((b: any) => String(b.tour_id)).filter(Boolean),
    );
    const wishlistTourIds = new Set<string>(
      wishlistData.map((w: any) => String(w.tour_id)).filter(Boolean),
    );

    const { data: tourRows, error: tourError } = await supabase
      .from('tours')
      .select(
        'id, slug, title, translations, city, duration, image_url, price, original_price, price_currency, rating, review_count',
      )
      .eq('is_active', true)
      .order('rating', { ascending: false })
      .limit(18);
    if (tourError) throw tourError;

    const krwPerUsd = await getKrwPerUsd();
    const recommendationPool = (tourRows ?? [])
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
        profile,
        userName: profile?.full_name?.trim()
          ? profile.full_name.trim().split(/\s+/)[0]
          : user.email?.split('@')[0] ?? 'User',
        counts: {
          bookings: bookingsData.length,
          upcoming: upcomingList.length,
          history: completedOrCancelled.length,
          reviews: reviews.length,
          wishlist: wishlistData.length,
        },
        nextTrip,
        pendingReviews,
        wishlistTotal: wishlistData.length,
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
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[api/mypage/summary] failed', error);
    return NextResponse.json({ error: 'Failed to load mypage summary' }, { status: 500 });
  }
}
