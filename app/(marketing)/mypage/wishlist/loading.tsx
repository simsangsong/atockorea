import { MyPageHeaderSkeleton, MyPageWishlistCardSkeleton } from '@/components/mypage/MyPageSkeletons';

/** Wishlist shape — header + saved-tour grid. */
export default function WishlistLoading() {
  return (
    <div className="space-y-4">
      <MyPageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <MyPageWishlistCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
