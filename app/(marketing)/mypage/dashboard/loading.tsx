import {
  MyPageHeaderSkeleton,
  MyPageLandingTilesSkeleton,
  MyPageLandingCarouselSkeleton,
} from '@/components/mypage/MyPageSkeletons';

/** Dashboard overview shape — header + quick tiles + a recommendations rail. */
export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <MyPageLandingTilesSkeleton />
      <MyPageLandingCarouselSkeleton count={3} />
    </div>
  );
}
