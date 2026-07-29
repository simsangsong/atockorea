import { MyPageHeaderSkeleton, MyPageListSkeleton, MyPageBookingCardSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Past tours shape — header + horizontal booking cards. */
export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <MyPageListSkeleton count={3} Item={MyPageBookingCardSkeleton} />
    </div>
  );
}
