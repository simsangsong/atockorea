'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { HeartSolidIcon, MapIcon, ClockIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

interface WishlistItem {
  id: string;
  tour_id: string;
  created_at: string;
  tours: {
    id: string;
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
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/mypage/wishlist');
        return;
      }

      const response = await fetch('/api/wishlist', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
    } catch (err: any) {
      console.error('Error fetching wishlist:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tourId: string, wishlistId: string) => {
    if (!confirm(t('mypage.wishlistRemoveConfirm'))) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        alert(t('mypage.wishlistSignInRequired'));
        return;
      }

      const response = await fetch(`/api/wishlist?tourId=${tourId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove from wishlist');
      }

      setWishlistItems(wishlistItems.filter((item) => item.id !== wishlistId));
    } catch (err: any) {
      console.error('Error removing from wishlist:', err);
      alert(t('mypage.wishlistRemoveFailed', { message: err.message }));
    }
  };

  const getImageUrl = (item: WishlistItem) => {
    if (item.tours?.image_url) return item.tours.image_url;
    if (item.tours?.images && item.tours.images.length > 0) {
      return Array.isArray(item.tours.images) ? item.tours.images[0] : item.tours.images;
    }
    return 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
  };

  const getPrice = (item: WishlistItem) => {
    const price = parseFloat(item.tours?.price?.toString() || '0');
    return price.toFixed(2);
  };

  const getOriginalPrice = (item: WishlistItem) => {
    if (!item.tours?.original_price) return null;
    const price = parseFloat(item.tours.original_price.toString());
    return price.toFixed(2);
  };

  const getDiscountPercent = (item: WishlistItem) => {
    if (!item.tours?.original_price || !item.tours?.price) return 0;
    const original = parseFloat(item.tours.original_price.toString());
    const current = parseFloat(item.tours.price.toString());
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
            <p className="text-[13px] text-slate-600">{t('mypage.wishlistLoading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-[13px] text-red-800">{t('mypage.bookingsError', { message: error })}</p>
          <button
            onClick={fetchWishlist}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
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

      {wishlistItems.length === 0 ? (
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-12 text-center')}>
          <HeartSolidIcon className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h2 className="mb-2 text-[15px] font-bold tracking-tight text-[#0f172a]">{t('wishlist.empty')}</h2>
          <p className="mb-6 text-[13px] text-slate-600">{t('wishlist.emptyDescription')}</p>
          <Link
            href="/tours/list"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
          >
            {t('wishlist.browseTours')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems.map((item) => {
            const discountPercent = getDiscountPercent(item);
            const originalPrice = getOriginalPrice(item);

            return (
              <div key={item.id} className={cn(MYPAGE_SURFACE_PAGE, 'overflow-hidden transition-all hover:-translate-y-[2px] hover:shadow-[0_14px_40px_-8px_rgba(15,23,42,0.14)]')}>
                <div className="group relative h-48">
                  <Link href={consumerTourDetailHref(item.tour_id)}>
                    <Image
                      src={getImageUrl(item)}
                      alt={item.tours?.title || 'Tour'}
                      fill
                      className="cursor-pointer object-cover"
                    />
                  </Link>
                  {discountPercent > 0 && (
                    <div className="absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-bold text-white shadow-md bg-red-500">
                      {discountPercent}% OFF
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(item.tour_id, item.id)}
                    className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:bg-red-50 group-hover:opacity-100"
                    title={t('wishlist.remove')}
                  >
                    <HeartSolidIcon className="h-5 w-5 text-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <Link href={consumerTourDetailHref(item.tour_id)}>
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
                    <div className="flex items-baseline gap-2">
                      {originalPrice && (
                        <span className="text-[12px] text-slate-400 line-through">${originalPrice}</span>
                      )}
                      <span className="text-[17px] font-bold text-[#0f172a]">${getPrice(item)}</span>
                      <span className="text-[11px] text-slate-500">/ {item.tours?.price_type || 'person'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={consumerTourDetailHref(item.tour_id)}
                      className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-center text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      {t('wishlist.viewDetails')}
                    </Link>
                    <button
                      onClick={() => handleRemove(item.tour_id, item.id)}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-200"
                      title={t('wishlist.remove')}
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
    </div>
  );
}
