'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDateIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { consumerTourDetailHref } from '@/lib/tour-consumer-visibility';
import { useTranslations, useI18n } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE, MYPAGE_SECTION_TITLE, MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/mypage/ConfirmDialog';
import { MyPageHeaderSkeleton, MyPageListSkeleton, MyPageReviewCardSkeleton } from '@/components/mypage/MyPageSkeletons';

interface Review {
  id: string;
  tour_id: string;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  title: string | null;
  images: string[] | null;
  created_at: string;
  tours: {
    id: string;
    slug?: string | null;
    title: string;
  } | null;
}

export default function ReviewsPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

        if (!session) {
          router.push('/signin');
          return;
        }

        const response = await fetch(`/api/reviews?userId=${session.user.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch reviews');
        }

        setReviews(data.reviews || []);
      } catch (err: any) {
        console.error('Error fetching reviews:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEdit = (review: Review) => {
    setMenuOpen(null);
    const qs = new URLSearchParams({
      reviewId: review.id,
      tourId: review.tour_id,
      tour: review.tours?.title || 'Tour',
      ...(review.booking_id ? { bookingId: review.booking_id } : {}),
    });
    router.push(`/mypage/reviews/write?${qs.toString()}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        toast.error(t('mypage.common.toast.signInRequired'));
        return;
      }
      const res = await fetch(`/api/reviews/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t('mypage.common.toast.reviewFailed', { message: data?.error || res.status }));
        return;
      }
      setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success(t('mypage.common.toast.reviewDeleted'));
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(t('mypage.common.toast.reviewFailed', { message: e?.message || 'unknown' }));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <MyPageHeaderSkeleton />
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <MyPageListSkeleton count={3} Item={MyPageReviewCardSkeleton} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
          <p className="text-[13px] text-red-600">{t('mypage.bookingsError', { message: error })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6 md:p-7')}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('mypage.reviews')}
        </p>
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[#0f172a] md:text-[1.5rem]">
          {t('mypage.reviewsPageTitle')}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">
          {t('mypage.reviewsPageSubtitle')}
        </p>
      </div>

      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <h2 className={cn(MYPAGE_SECTION_TITLE, 'mb-4')}>{t('mypage.reviewsSectionTitle')}</h2>
        {reviews.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500">{t('mypage.reviewsEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={consumerTourDetailHref(review.tour_id, review.tours?.slug ?? null)}
                      className={cn(
                        'text-[14px] font-semibold text-[#0f172a] transition-colors hover:text-slate-700',
                        MYPAGE_FOCUS_RING,
                      )}
                    >
                      {review.tours?.title || 'Tour'}
                    </Link>
                    <div className="mt-1 mb-2 flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={cn(
                            'h-4 w-4',
                            i < review.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-200 text-slate-200',
                          )}
                        />
                      ))}
                    </div>
                    {review.title && (
                      <h3 className="mb-1 text-[13px] font-semibold text-slate-800">{review.title}</h3>
                    )}
                    {review.comment && (
                      <p className="mb-2 text-[13px] leading-relaxed text-slate-700">{review.comment}</p>
                    )}
                    {review.images && review.images.length > 0 && (
                      <div className="mb-2 flex gap-2">
                        {review.images.slice(0, 3).map((image, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={idx}
                            src={image}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ))}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <CalendarDateIcon className="h-3.5 w-3.5" />
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                  <div className="relative" ref={menuOpen === review.id ? menuRef : null}>
                    <button
                      type="button"
                      aria-label={t('mypage.reviews.cardMenu')}
                      aria-expanded={menuOpen === review.id}
                      onClick={() => setMenuOpen((prev) => (prev === review.id ? null : review.id))}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900',
                        MYPAGE_FOCUS_RING,
                      )}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                    {menuOpen === review.id && (
                      <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        <button
                          type="button"
                          onClick={() => handleEdit(review)}
                          className="block w-full px-3 py-2 text-left text-[13px] text-slate-800 hover:bg-slate-50"
                        >
                          {t('mypage.reviews.cardEdit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(null);
                            setDeleteTarget(review);
                          }}
                          className="block w-full px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                        >
                          {t('mypage.reviews.cardDelete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('mypage.reviews.deleteConfirmTitle')}
        description={t('mypage.reviews.deleteConfirmDescription')}
        confirmLabel={t('mypage.reviews.deleteConfirmCta')}
        cancelLabel={t('mypage.common.confirm.cancel')}
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
