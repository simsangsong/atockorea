'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { HeartSolidIcon, MapIcon, ClockIcon, StarIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import {
  MYPAGE_SURFACE_PAGE,
  MYPAGE_SECTION_TITLE,
  MYPAGE_FOCUS_RING,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/mypage/ConfirmDialog';
import { MyPageHeaderSkeleton, MyPageWishlistCardSkeleton } from '@/components/mypage/MyPageSkeletons';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

interface WishlistItem {
  id: string;
  tour_id: string;
  created_at: string;
  tours: {
    id: string;
    slug?: string | null;
    title: string;
    city: string;
    price: number;
    original_price?: number | null;
    price_type: string;
    image_url: string;
    images?: string[];
    rating?: number;
    review_count?: number;
    duration?: string;
  } | null;
}

export default function WishlistPage() {
  const router = useRouter();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const { getAccessToken } = useMyPageSession();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WishlistItem | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    fetchWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        router.push('/signin?redirect=/mypage/wishlist');
        return;
      }

      const response = await fetch('/api/wishlist', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/mypage/wishlist');
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch wishlist');
      }

      const data = await response.json();
      setWishlistItems(data.wishlist || []);
    } catch (err: unknown) {
      console.error('Error fetching wishlist:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wishlist');
    } finally {
      setLoading(false);
    }
  };

  const performRemove = async () => {
    if (!removeTarget) return;

    try {
      setRemoveBusy(true);
      const token = await getAccessToken();
      if (!token) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }

      const response = await fetch(`/api/wishlist?tourId=${removeTarget.tour_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove from wishlist');
      }

      setWishlistItems((items) => items.filter((item) => item.id !== removeTarget.id));
      toast.success(t('mypage.common.toast.wishlistRemoved'));
      setRemoveTarget(null);
    } catch (err: unknown) {
      console.error('Error removing from wishlist:', err);
      toast.error(t('mypage.common.toast.wishlistRemoveFailed'), {
        description: err instanceof Error ? err.message : 'Failed to remove from wishlist',
      });
    } finally {
      setRemoveBusy(false);
    }
  };

  const getImageUrl = (item: WishlistItem) => {
    if (item.tours?.image_url) return item.tours.image_url;
    if (item.tours?.images && item.tours.images.length > 0) {
      return Array.isArray(item.tours.images) ? item.tours.images[0] : item.tours.images;
    }
    return 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
  };

  const getDiscountPercent = (item: WishlistItem) => {
    if (!item.tours?.original_price || !item.tours?.price) return 0;
    const original = parseFloat(String(item.tours.original_price));
    const current = parseFloat(String(item.tours.price));
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <MyPageHeaderSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MyPageWishlistCardSkeleton />
          <MyPageWishlistCardSkeleton />
          <MyPageWishlistCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-red-600">{t('mypage.bookingsError', { message: error })}</p>
          <button
            type="button"
            onClick={fetchWishlist}
            className={cn(
              'mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.commonRetry')}
          </button>
        </div>
      </div>
    );
  }

  const countCopy =
    wishlistItems.length === 1
      ? t('mypage.wishlistCountOne', { count: wishlistItems.length })
      : t('mypage.wishlistCountMany', { count: wishlistItems.length });

  return (
    <div className="space-y-4">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('mypage.wishlist')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.wishlistPageTitle')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">{countCopy}</p>
      </div>

      <section>
        <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-3 px-1')}>{t('mypage.wishlist')}</h2>
        {wishlistItems.length === 0 ? (
          <div className={cn(MYPAGE_SURFACE_PAGE, 'p-12 text-center')}>
            <HeartSolidIcon className="mx-auto mb-4 h-14 w-14 text-slate-300" />
            <h3 className="mb-2 text-[15px] font-bold tracking-tight text-[#0f172a]">{t('wishlist.empty')}</h3>
            <p className="mb-6 text-[13px] text-slate-600">{t('wishlist.emptyDescription')}</p>
            <Link
              href="/tours/list"
              className={cn(
                'inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800',
                MYPAGE_FOCUS_RING,
              )}
            >
              {t('wishlist.browseTours')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wishlistItems.map((item) => {
              const discountPercent = getDiscountPercent(item);
              const originalPriceNum = item.tours?.original_price
                ? parseFloat(String(item.tours.original_price))
                : null;
              const priceNum = item.tours?.price ? parseFloat(String(item.tours.price)) : 0;
              const detailHref = consumerTourDetailHref(item.tour_id, item.tours?.slug ?? null);

              return (
                <div
                  key={item.id}
                  className={cn(
                    MYPAGE_SURFACE_PAGE,
                    'overflow-hidden transition-all hover:-translate-y-[2px] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.14)]',
                  )}
                >
                  <div className="group relative h-48">
                    <Link href={detailHref}>
                      <Image
                        src={getImageUrl(item)}
                        alt={item.tours?.title || 'Tour'}
                        fill
                        className="cursor-pointer object-cover"
                      />
                    </Link>
                    {discountPercent > 0 && (
                      <div className="absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-bold text-white shadow-md bg-red-500">
                        {t('mypage.common.percentOff', { value: discountPercent })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(item)}
                      className={cn(
                        'absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md transition-all backdrop-blur',
                        'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                        'hover:bg-red-50',
                        MYPAGE_FOCUS_RING,
                      )}
                      title={t('wishlist.remove')}
                      aria-label={t('wishlist.remove')}
                    >
                      <HeartSolidIcon className="h-5 w-5 text-red-500" />
                    </button>
                  </div>
                  <div className="p-4">
                    <Link href={detailHref}>
                      <h3 className="mb-2 line-clamp-2 text-[14px] font-semibold tracking-tight text-[#0f172a] transition-colors hover:text-slate-700">
                        {item.tours?.title || 'Tour'}
                      </h3>
                    </Link>

                    <div className="mb-3 flex items-center gap-3 text-[11px] text-slate-600">
                      {item.tours?.city && (
                        <div className="flex items-center gap-1">
                          <MapIcon className="h-3.5 w-3.5" />
                          <span>{item.tours.city}</span>
                        </div>
                      )}
                      {item.tours?.duration && (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          <span>{item.tours.duration}</span>
                        </div>
                      )}
                    </div>

                    {item.tours?.rating && item.tours.rating > 0 && (
                      <div className="mb-3 flex items-center gap-1">
                        <StarIcon className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-[13px] font-semibold text-[#0f172a]">
                          {item.tours.rating.toFixed(1)}
                        </span>
                        {item.tours.review_count && item.tours.review_count > 0 && (
                          <span className="text-[11px] text-slate-500">({item.tours.review_count})</span>
                        )}
                      </div>
                    )}

                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        {originalPriceNum && originalPriceNum > priceNum && (
                          <span className="text-[12px] text-slate-400 line-through">
                            {formatPrice(originalPriceNum)}
                          </span>
                        )}
                        <span className="text-[17px] font-bold text-[#0f172a]">{formatPrice(priceNum)}</span>
                        <span className="text-[11px] text-slate-500">/ {item.tours?.price_type || 'person'}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={detailHref}
                        className={cn(
                          'flex-1 rounded-xl bg-slate-900 px-4 py-2 text-center text-[13px] font-semibold text-white transition-colors hover:bg-slate-800',
                          MYPAGE_FOCUS_RING,
                        )}
                      >
                        {t('wishlist.viewDetails')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(item)}
                        className={cn(
                          'rounded-xl bg-slate-100 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-200',
                          MYPAGE_FOCUS_RING,
                        )}
                        title={t('wishlist.remove')}
                        aria-label={t('wishlist.remove')}
                      >
                        <HeartSolidIcon className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={t('mypage.common.confirm.removeWishlistTitle')}
        description={t('mypage.common.confirm.removeWishlistDescription')}
        confirmLabel={t('mypage.common.confirm.removeWishlistConfirm')}
        cancelLabel={t('mypage.common.confirm.cancel')}
        destructive
        loading={removeBusy}
        onConfirm={performRemove}
      />
    </div>
  );
}
