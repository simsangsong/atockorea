'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ClockIcon, HeartSolidIcon, MapIcon } from '@/components/Icons';
import { ConfirmDialog } from '@/components/mypage/ConfirmDialog';
import { useTranslations } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { MYPAGE_FOCUS_RING, MYPAGE_SECTION_TITLE, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from '../MyPageSessionProvider';

export interface WishlistCarouselItem {
  id: string;
  tour_id: string;
  title: string;
  slug?: string | null;
  city?: string | null;
  duration?: string | null;
  image_url?: string | null;
  price?: number | null;
  original_price?: number | null;
}

interface WishlistCarouselProps {
  items: WishlistCarouselItem[];
  totalCount: number;
  /** Callback after successful removal — parent should update its local state. */
  onRemoved?: (wishlistId: string) => void;
}

export function WishlistCarousel({ items, totalCount, onRemoved }: WishlistCarouselProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const { getAccessToken } = useMyPageSession();
  const [removeTarget, setRemoveTarget] = useState<WishlistCarouselItem | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  if (items.length === 0) return null;

  const performRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoveBusy(true);
      const token = await getAccessToken();
      if (!token) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }
      const res = await fetch(`/api/wishlist?tourId=${removeTarget.tour_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to remove from wishlist');
      }
      onRemoved?.(removeTarget.id);
      toast.success(t('mypage.common.toast.wishlistRemoved'));
      setRemoveTarget(null);
    } catch (e: unknown) {
      console.error('[landing/WishlistCarousel] remove failed', e);
      toast.error(t('mypage.common.toast.wishlistRemoveFailed'));
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className={MYPAGE_SECTION_TITLE}>{t('mypage.landing.wishlist.sectionTitle')}</h2>
        {totalCount > items.length && (
          <Link
            href="/mypage/wishlist"
            className={cn(
              'text-[12px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline',
              MYPAGE_FOCUS_RING,
            )}
          >
            {t('mypage.landing.wishlist.viewAll', { count: totalCount })} →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((item) => {
          const href = consumerTourDetailHref(item.tour_id, item.slug ?? null);
          const image = item.image_url || 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
          return (
            <div key={item.id} className={cn(MYPAGE_SURFACE_PAGE, 'group relative overflow-hidden')}>
              <Link
                href={href}
                className={cn('block', MYPAGE_FOCUS_RING)}
              >
                <div className="relative aspect-[16/10] w-full">
                  <Image src={image} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 300px" />
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setRemoveTarget(item)}
                aria-label={t('mypage.common.confirm.removeWishlistConfirm')}
                className={cn(
                  'absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-rose-600 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.25)] backdrop-blur transition-colors hover:bg-white',
                  MYPAGE_FOCUS_RING,
                )}
              >
                <HeartSolidIcon className="h-4 w-4" />
              </button>
              <div className="space-y-1.5 p-4">
                <Link
                  href={href}
                  className={cn('block', MYPAGE_FOCUS_RING)}
                >
                  <h3 className="truncate text-[14px] font-semibold text-[#0f172a]">{item.title}</h3>
                </Link>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  {item.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapIcon className="h-3 w-3" />
                      {item.city}
                    </span>
                  )}
                  {item.duration && (
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {item.duration}
                    </span>
                  )}
                </div>
                {typeof item.price === 'number' && (
                  <p className="pt-1 text-[14px] font-bold tabular-nums text-[#0f172a]">
                    {formatPrice(item.price)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title={t('mypage.common.confirm.removeWishlistTitle')}
        description={t('mypage.common.confirm.removeWishlistDescription')}
        confirmLabel={t('mypage.common.confirm.removeWishlistConfirm')}
        cancelLabel={t('mypage.common.confirm.cancel')}
        destructive
        loading={removeBusy}
        onConfirm={performRemove}
      />
    </section>
  );
}
