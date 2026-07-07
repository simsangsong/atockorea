import { MyPageHeaderSkeleton, MyPageListSkeleton, MyPageBookingCardSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Upcoming tours shape — header + horizontal booking cards. */
export default function UpcomingLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <MyPageListSkeleton count={3} Item={MyPageBookingCardSkeleton} />
    </div>
  );
}
