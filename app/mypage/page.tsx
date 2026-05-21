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
import { cn } from '@/lib/utils';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

type MyPageSummaryResponse = {
  profile: ProfileCompletionInput | null;
  userName: string;
  counts: Omit<QuickAccessCounts, 'settingsPct'>;
  nextTrip: NextTripData | null;
  pendingReviews: PendingReviewItem[];
  wishlistItems: WishlistCarouselItem[];
  wishlistTotal: number;
  recommendations: RecommendedTour[];
  error?: string;
};

type MyPageExtrasResponse = {
  wishlistItems: WishlistCarouselItem[];
  recommendations: RecommendedTour[];
  error?: string;
};

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
  const { user, getAccessToken } = useMyPageSession();

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
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [hadError, setHadError] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setHadError(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.push('/signin?redirect=/mypage');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` } as const;

      const res = await fetch(`/api/mypage/summary?locale=${encodeURIComponent(locale)}`, { headers });
      const data = (await res.json().catch(() => ({}))) as MyPageSummaryResponse;
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to load mypage summary');
      }

      setProfile(data.profile);
      setUserName(data.userName || user?.email?.split('@')[0] || 'User');
      setCounts((prev) => ({ ...prev, ...data.counts }));
      setNextTrip(data.nextTrip);
      setPendingReviews(data.pendingReviews);
      setWishlistItems(data.wishlistItems);
      setWishlistTotal(data.wishlistTotal);
      setRecommendations(data.recommendations);
      setHadError(false);

      setExtrasLoading(true);
      void fetch(`/api/mypage/extras?locale=${encodeURIComponent(locale)}`, { headers })
        .then(async (extrasRes) => {
          const extras = (await extrasRes.json().catch(() => ({}))) as MyPageExtrasResponse;
          if (!extrasRes.ok) throw new Error(extras.error ?? 'Failed to load mypage extras');
          setWishlistItems(extras.wishlistItems ?? []);
          setRecommendations(extras.recommendations ?? []);
        })
        .catch((extrasError) => {
          console.error('[mypage/landing] fetch extras failed', extrasError);
        })
        .finally(() => setExtrasLoading(false));
    } catch (e) {
      console.error('[mypage/landing] fetchAll failed', e);
      setHadError(true);
      setExtrasLoading(false);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, locale, router, user?.email]);

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

      {extrasLoading && <MyPageLandingCarouselSkeleton count={3} />}

      {(!extrasLoading || recommendations.length > 0) && <RecommendedTours tours={recommendations} />}
    </div>
  );
}
