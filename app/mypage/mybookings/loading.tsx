import { MyPageHeaderSkeleton, MyPageListSkeleton, MyPageBookingCardSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Bookings list shape — header + horizontal booking cards. */
export default function MyBookingsLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <MyPageListSkeleton count={3} Item={MyPageBookingCardSkeleton} />
    </div>
  );
}
