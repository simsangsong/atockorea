'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  computeProfileCompletion,
  type ProfileCompletionInput,
  WelcomeHero,
} from '@/components/mypage/landing/WelcomeHero';
import { NextTripHero, type NextTripData } from '@/components/mypage/landing/NextTripHero';
import {
  QuickAccessTiles,
  type QuickAccessCounts,
} from '@/components/mypage/landing/QuickAccessTiles';
import {
  PendingReviewTeaser,
  type PendingReviewItem,
} from '@/components/mypage/landing/PendingReviewTeaser';
import {
  WishlistCarousel,
  type WishlistCarouselItem,
} from '@/components/mypage/landing/WishlistCarousel';
import {
  RecommendedTours,
  type RecommendedTour,
} from '@/components/mypage/landing/RecommendedTours';
import {
  MyPageLandingCarouselSkeleton,
  MyPageLandingHeroSkeleton,
  MyPageLandingTilesSkeleton,
} from '@/components/mypage/MyPageSkeletons';
import { useI18n, useTranslations } from '@/lib/i18n';
import { MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  isReviewWriteWindowOpen,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';

/**
 * /mypage landing hub (Option A + mixed_premium).
 *
 * Distinct from `/mypage/dashboard`: this hub surfaces a hero next-trip card,
 * quick-access tiles, pending-review nudge, wishlist carousel, and curated
 * recommendations. The dashboard remains the numeric/activity view.
 */
export default function MyPageLandingPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useI18n();

  const [userName, setUserName] = useState('User');
  const [profile, setProfile] = useState<ProfileCompletionInput | null>(null);

  const [nextTrip, setNextTrip] = useState<NextTripData | null>(null);
  const [counts, setCounts] = useState<QuickAccessCounts>({
    bookings: 0,
    upcoming: 0,
    history: 0,
    reviews: 0,
    wishlist: 0,
    settingsPct: 0,
  });
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistCarouselItem[]>([]);
  const [wishlistTotal, setWishlistTotal] = useState(0);
  const [recommendations, setRecommendations] = useState<RecommendedTour[]>([]);

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setHadError(false);

    try {
      if (!supabase) {
        router.push('/signin?redirect=/mypage');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/signin?redirect=/mypage');
        return;
      }

      const userId = session.user.id;
      const token = session.access_token;
      const headers = { Authorization: `Bearer ${token}` } as const;

      const { data: profileRow } = await supabase
        .from('user_profiles')
        .select('full_name, phone, birth_year, nationality, language_preference, avatar_url')
        .eq('id', userId)
        .single();

      if (profileRow) {
        setProfile(profileRow as ProfileCompletionInput);
        const display = (profileRow as any).full_name as string | null;
        if (display && display.trim()) {
          setUserName(display.trim().split(/\s+/)[0]);
        } else if (session.user.email) {
          setUserName(session.user.email.split('@')[0]);
        }
      } else if (session.user.email) {
        setUserName(session.user.email.split('@')[0]);
      }

      let sawError = false;
      let reviewedBookingIds = new Set<string>();
      let bookingsData: any[] = [];
      let wishlistData: any[] = [];

      const [bookingsRes, reviewsRes, wishlistRes] = await Promise.all([
        fetch('/api/bookings', { headers }).catch(() => null),
        fetch(`/api/reviews?userId=${userId}`, { headers }).catch(() => null),
        fetch('/api/wishlist', { headers }).catch(() => null),
      ]);

      if (reviewsRes && reviewsRes.ok) {
        const data = await reviewsRes.json();
        const reviews = (data?.reviews ?? []) as any[];
        reviewedBookingIds = new Set(
          reviews.map((r) => r.booking_id).filter(Boolean),
        );
        setCounts((prev) => ({ ...prev, reviews: reviews.length }));
      } else {
        sawError = true;
      }

      if (bookingsRes && bookingsRes.ok) {
        const data = await bookingsRes.json();
        bookingsData = (data?.bookings ?? []) as any[];

        const now = new Date();
        const upcomingList = bookingsData
          .filter((b) => {
            const tourDate = new Date(b.tour_date || b.booking_date || b.created_at);
            return (b.status === 'confirmed' || b.status === 'pending') && tourDate >= now;
          })
          .sort((a, b) => {
            const da = new Date(a.tour_date || a.booking_date).getTime();
            const db = new Date(b.tour_date || b.booking_date).getTime();
            return da - db;
          });

        const completedOrCancelled = bookingsData.filter((b) =>
          b.status === 'completed' || b.status === 'cancelled',
        );

        setCounts((prev) => ({
          ...prev,
          bookings: bookingsData.length,
          upcoming: upcomingList.length,
          history: completedOrCancelled.length,
        }));

        const first = upcomingList[0];
        if (first) {
          setNextTrip({
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
          });
        } else {
          setNextTrip(null);
        }

        const pending = bookingsData
          .filter((b) => {
            if (b.status !== 'completed') return false;
            if (reviewedBookingIds.has(b.id)) return false;
            const ymd = normalizeBookingTourDateYmd(b.tour_date || null);
            return ymd ? isReviewWriteWindowOpen(ymd) : false;
          })
          .slice(0, 5)
          .map((b) => ({
            bookingId: b.id,
            tourId: b.tour_id,
            slug: b.tours?.slug ?? null,
            title: b.tours?.title || 'Tour',
          }));
        setPendingReviews(pending);
      } else {
        sawError = true;
      }

      if (wishlistRes && wishlistRes.ok) {
        const data = await wishlistRes.json();
        wishlistData = (data?.wishlist ?? []) as any[];
        setWishlistTotal(wishlistData.length);
        setCounts((prev) => ({ ...prev, wishlist: wishlistData.length }));
        setWishlistItems(
          wishlistData.slice(0, 3).map((w) => ({
            id: w.id,
            tour_id: w.tour_id,
            title: w.tours?.title ?? 'Tour',
            slug: w.tours?.slug ?? null,
            city: w.tours?.city ?? null,
            duration: w.tours?.duration ?? null,
            image_url: w.tours?.image_url ?? null,
            price: typeof w.tours?.price === 'number' ? w.tours.price : null,
            original_price:
              typeof w.tours?.original_price === 'number' ? w.tours.original_price : null,
          })),
        );
      } else {
        sawError = true;
      }

      const bookedTourIds = new Set<string>(
        bookingsData.map((b) => String(b.tour_id)).filter(Boolean),
      );
      const wishlistTourIds = new Set<string>(
        wishlistData.map((w) => String(w.tour_id)).filter(Boolean),
      );

      try {
        const tourRes = await fetch(
          `/api/tours?sortBy=rating&sortOrder=desc&limit=12&locale=${encodeURIComponent(locale)}`,
        );
        if (!tourRes.ok) {
          sawError = true;
        } else {
          const data = await tourRes.json();
          const list = (data?.tours ?? []) as any[];
          const filtered = list
            .filter((tour) => {
              const id = String(tour.id ?? '');
              if (!id) return false;
              if (bookedTourIds.has(id)) return false;
              if (wishlistTourIds.has(id)) return false;
              return true;
            })
            .slice(0, 6);
          const picked = filtered.length >= 3 ? filtered : list.slice(0, 6);
          setRecommendations(
            picked.map((tour) => ({
              id: String(tour.id),
              slug: tour.slug ?? null,
              title: tour.title ?? 'Tour',
              image: tour.image ?? null,
              city: tour.city ?? tour.location ?? null,
              duration: tour.duration ?? null,
              price: typeof tour.price === 'number' ? tour.price : null,
              rating: typeof tour.rating === 'number' ? tour.rating : null,
              reviewCount:
                typeof tour.reviewCount === 'number' ? tour.reviewCount : null,
            })),
          );
        }
      } catch (e) {
        console.error('[mypage/landing] recommendations fetch failed', e);
        sawError = true;
      }

      setHadError(sawError);
    } catch (e) {
      console.error('[mypage/landing] fetchAll failed', e);
      setHadError(true);
    } finally {
      setLoading(false);
    }
  }, [locale, router]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const settingsPct = useMemo(() => computeProfileCompletion(profile), [profile]);

  const countsForTiles: QuickAccessCounts = useMemo(
    () => ({ ...counts, settingsPct }),
    [counts, settingsPct],
  );

  const handleWishlistRemoved = useCallback((wishlistId: string) => {
    setWishlistItems((items) => items.filter((w) => w.id !== wishlistId));
    setWishlistTotal((n) => Math.max(0, n - 1));
    setCounts((prev) => ({ ...prev, wishlist: Math.max(0, prev.wishlist - 1) }));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <MyPageLandingHeroSkeleton />
        <MyPageLandingHeroSkeleton />
        <MyPageLandingTilesSkeleton />
        <MyPageLandingCarouselSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WelcomeHero name={userName} profile={profile} />

      {hadError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <span>{t('mypage.landing.errorBanner')}</span>
          <button
            type="button"
            onClick={() => void fetchAll()}
            className={cn(
              'rounded-lg border border-amber-300 bg-white px-3 py-1 text-[12px] font-semibold text-amber-900 transition-colors hover:bg-amber-100',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.landing.retry')}
          </button>
        </div>
      )}

      <NextTripHero trip={nextTrip} />

      <QuickAccessTiles counts={countsForTiles} />

      <PendingReviewTeaser items={pendingReviews} />

      <WishlistCarousel
        items={wishlistItems}
        totalCount={wishlistTotal}
        onRemoved={handleWishlistRemoved}
      />

      <RecommendedTours tours={recommendations} />
    </div>
  );
}
