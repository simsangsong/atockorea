import {
  MyPageLandingCarouselSkeleton,
  MyPageLandingHeroSkeleton,
  MyPageLandingTilesSkeleton,
} from '@/components/mypage/MyPageSkeletons';

/**
 * Route-level loading boundary for /mypage/*. The mypage shell is a static
 * prerender (all data loads client-side), so this mostly covers un-prefetched
 * client navigations — the bottom-nav tap paints this skeleton instantly
 * instead of freezing on the previous page while the RSC payload streams.
 */
export default function MyPageLoading() {
  return (
    <div className="space-y-4">
      <MyPageLandingHeroSkeleton />
      <MyPageLandingTilesSkeleton />
      <MyPageLandingCarouselSkeleton count={3} />
    </div>
  );
}
