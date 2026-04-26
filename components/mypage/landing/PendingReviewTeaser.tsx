'use client';

import Link from 'next/link';
import { StarIcon } from '@/components/Icons';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_FOCUS_RING, MYPAGE_SURFACE_PAGE } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';

export interface PendingReviewItem {
  bookingId: string;
  tourId: string;
  slug?: string | null;
  title: string;
}

interface PendingReviewTeaserProps {
  items: PendingReviewItem[];
}

/**
 * Inline "write review" nudge. Shows the first pending item as a CTA and, if
 * more remain, a compact counter link to the Reviews page. Hidden entirely
 * when `items` is empty (callers can conditionally render).
 */
export function PendingReviewTeaser({ items }: PendingReviewTeaserProps) {
  const t = useTranslations();
  if (items.length === 0) return null;

  const [first, ...rest] = items;
  const writeHref = `/mypage/reviews/write?tourId=${first.tourId}&bookingId=${first.bookingId}&tour=${encodeURIComponent(first.title)}`;

  return (
    <div
      className={cn(
        MYPAGE_SURFACE_PAGE,
        'flex flex-col items-start gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <StarIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#0f172a]">
            {t('mypage.landing.pendingReview.title', { title: first.title })}
          </p>
          {rest.length > 0 && (
            <Link
              href="/mypage/reviews"
              className={cn(
                'mt-0.5 inline-flex text-[11px] font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline',
                MYPAGE_FOCUS_RING,
              )}
            >
              {t('mypage.landing.pendingReview.more', { count: rest.length })}
            </Link>
          )}
        </div>
      </div>
      <Link
        href={writeHref}
        className={cn(
          'inline-flex min-h-[40px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800',
          MYPAGE_FOCUS_RING,
        )}
      >
        {t('mypage.landing.pendingReview.cta')}
      </Link>
    </div>
  );
}
