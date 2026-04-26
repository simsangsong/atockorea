'use client';

import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

/** Header card shimmer (page title block). */
export function MyPageHeaderSkeleton() {
  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
      <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/80" />
      <div className="mt-3 h-6 w-56 animate-pulse rounded-full bg-slate-200/80" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded-full bg-slate-200/60" />
    </div>
  );
}

/** Horizontal booking card shimmer (mybookings / upcoming / history). */
export function MyPageBookingCardSkeleton() {
  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
      <div className="flex flex-col md:flex-row">
        <div className="h-48 w-full flex-shrink-0 animate-pulse bg-slate-200/70 md:h-auto md:w-48" />
        <div className="flex-1 space-y-3 p-5">
          <div className="h-4 w-3/5 animate-pulse rounded-full bg-slate-200/80" />
          <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200/60" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200/60" />
          <div className="flex gap-2 pt-2">
            <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/70" />
            <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wishlist grid card shimmer. */
export function MyPageWishlistCardSkeleton() {
  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
      <div className="h-48 w-full animate-pulse bg-slate-200/70" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200/80" />
        <div className="h-3 w-2/4 animate-pulse rounded-full bg-slate-200/60" />
        <div className="h-5 w-1/3 animate-pulse rounded-full bg-slate-200/60" />
        <div className="flex gap-2 pt-1">
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-9 w-10 animate-pulse rounded-xl bg-slate-200/50" />
        </div>
      </div>
    </div>
  );
}

/** Review list tile shimmer. */
export function MyPageReviewCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)]">
      <div className="h-4 w-2/5 animate-pulse rounded-full bg-slate-200/80" />
      <div className="mt-2 flex gap-1">
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200/70" />
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200/70" />
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200/70" />
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200/70" />
        <div className="h-4 w-4 animate-pulse rounded-sm bg-slate-200/70" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-slate-200/60" />
        <div className="h-3 w-8/12 animate-pulse rounded-full bg-slate-200/60" />
      </div>
    </div>
  );
}

/** Landing hero card shimmer (WelcomeHero / NextTripHero). */
export function MyPageLandingHeroSkeleton() {
  return (
    <div className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden p-0')}>
      <div className="relative h-56 w-full animate-pulse bg-slate-200/70 md:h-64" />
      <div className="space-y-3 p-5 md:p-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/70" />
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200/80" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200/60" />
        <div className="flex gap-2 pt-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/50" />
        </div>
      </div>
    </div>
  );
}

/** Landing quick-access tiles shimmer (6 tiles). */
export function MyPageLandingTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn(MYPAGE_SURFACE_PAGE, 'p-4')}>
          <div className="mb-3 h-9 w-9 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-200/70" />
          <div className="mt-2 h-3 w-2/5 animate-pulse rounded-full bg-slate-200/50" />
        </div>
      ))}
    </div>
  );
}

/** Landing carousel shimmer (wishlist / recommendations rail). */
export function MyPageLandingCarouselSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden')}>
          <div className="h-40 w-full animate-pulse bg-slate-200/70" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/60" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-slate-200/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Reusable list skeleton (N rows). Accepts custom item component. */
export function MyPageListSkeleton({
  count = 2,
  Item = MyPageBookingCardSkeleton,
}: {
  count?: number;
  Item?: React.ComponentType;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}
