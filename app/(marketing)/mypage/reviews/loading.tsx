import { MyPageHeaderSkeleton, MyPageListSkeleton, MyPageReviewCardSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Reviews shape — header + review list tiles. */
export default function ReviewsLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <MyPageListSkeleton count={3} Item={MyPageReviewCardSkeleton} />
    </div>
  );
}
