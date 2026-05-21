'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { MYPAGE_SURFACE_PAGE, MYPAGE_FOCUS_RING } from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { useMyPageSession } from '@/components/mypage/MyPageSessionProvider';

function WriteReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { user, getAccessToken } = useMyPageSession();
  const tourId = searchParams?.get('tourId');
  const bookingId = searchParams?.get('bookingId');
  const reviewId = searchParams?.get('reviewId');
  const tourName = searchParams?.get('tour') || 'Tour';

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(reviewId));
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(reviewId);

  useEffect(() => {
    if (!reviewId && (!tourId || !bookingId)) {
      router.push('/mypage/mybookings');
    }
  }, [reviewId, tourId, bookingId, router]);

  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`/api/reviews/${reviewId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const r = data.review || data;
        if (r) {
          setRating(Number(r.rating) || 0);
          setTitle(r.title || '');
          setComment(r.comment || '');
          setImages(Array.isArray(r.images) ? r.images : []);
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, reviewId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      if (!supabase) throw new Error('supabase unavailable');
      if (!user) {
        toast.error(t('mypage.reviews.write.signInToUpload'));
        return;
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reviews/${fileName}`;

        const uploadResult = await supabase!.storage.from('reviews').upload(filePath, file);
        if (!uploadResult || uploadResult.error) {
          throw new Error(uploadResult?.error?.message || 'upload-failed');
        }

        const { data } = supabase!.storage.from('reviews').getPublicUrl(filePath);
        return data?.publicUrl ?? null;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages([...images, ...(uploadedUrls.filter((url) => url !== null) as string[])]);
    } catch (err: unknown) {
      console.error('Error uploading images:', err);
      toast.error(t('mypage.reviews.write.photosUploadFailed'));
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      setError(t('mypage.reviews.write.ratingRequired'));
      return;
    }

    if (!comment.trim()) {
      setError(t('mypage.reviews.write.commentRequired'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!supabase) throw new Error('supabase unavailable');
      const token = await getAccessToken();

      if (!token) {
        toast.error(t('mypage.reviews.write.signInToSubmit'));
        router.push('/signin');
        return;
      }

      const endpoint = isEdit ? `/api/reviews/${reviewId}` : '/api/reviews';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tourId,
          bookingId,
          rating,
          title: title.trim() || null,
          comment: comment.trim(),
          images: images.length > 0 ? images : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const code = (data?.error as string | undefined) || '';
        if (code === 'REVIEW_WINDOW_NOT_OPEN') {
          const msg = t('mypage.reviews.write.windowNotOpen');
          setError(msg);
          toast.error(msg);
          return;
        }
        throw new Error(code || t('mypage.reviews.write.genericError'));
      }

      toast.success(isEdit ? t('mypage.common.toast.reviewUpdated') : t('mypage.common.toast.reviewSubmitted'));
      router.push('/mypage/reviews');
    } catch (err: unknown) {
      console.error('Error creating review:', err);
      const msg = err instanceof Error ? err.message : t('mypage.reviews.write.genericError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const starInput = cn(
    'rounded-md p-1 transition-colors',
    MYPAGE_FOCUS_RING,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
        <h1 className="mb-1 text-[1.25rem] font-semibold tracking-tight text-slate-900">
          {isEdit ? t('mypage.reviews.write.editTitle') : t('mypage.reviews.write.title')}
        </h1>
        <p className="mb-6 text-[13px] text-slate-600">
          {t('mypage.reviews.write.subtitle', { tour: tourName })}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">
            {error}
          </div>
        )}

        {loadingExisting ? (
          <div className="py-10 text-center text-[13px] text-slate-500" role="status" aria-live="polite">
            {t('mypage.common.loadingLabel')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700" id="review-rating-label">
                {t('mypage.reviews.write.ratingLabel')} <span className="text-red-500">*</span>
              </label>
              <div
                role="radiogroup"
                aria-labelledby="review-rating-label"
                className="flex items-center gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (hoverRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={t('mypage.reviews.write.ratingSrLabel', { value: star })}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      className={starInput}
                    >
                      <StarIcon
                        className={cn(
                          'h-8 w-8 transition-colors',
                          active ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 fill-slate-200',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="title" className="mb-2 block text-[13px] font-medium text-slate-700">
                {t('mypage.reviews.write.titleLabel')}
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={cn(
                  'w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[14px] text-slate-900 outline-none transition-all',
                  'focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20',
                )}
                placeholder={t('mypage.reviews.write.titlePlaceholder')}
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="comment" className="mb-2 block text-[13px] font-medium text-slate-700">
                {t('mypage.reviews.write.commentLabel')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={6}
                className={cn(
                  'w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[14px] text-slate-900 outline-none transition-all',
                  'focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20',
                )}
                placeholder={t('mypage.reviews.write.commentPlaceholder')}
                required
              />
              <p className="mt-1 text-[12px] text-slate-500">
                {t('mypage.reviews.write.commentCount', { count: comment.length })}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-slate-700">
                {t('mypage.reviews.write.photosLabel')}
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className={cn(
                  'w-full rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-[13px] text-slate-700 outline-none',
                  'file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white',
                  MYPAGE_FOCUS_RING,
                )}
              />
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={t('mypage.reviews.write.photosLabel')}
                        className="h-24 w-full rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label="Remove photo"
                        className={cn(
                          'absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600',
                          MYPAGE_FOCUS_RING,
                        )}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className={cn(
                  'flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-800 transition-colors hover:bg-slate-50',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {t('mypage.reviews.write.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !rating || !comment.trim()}
                className={cn(
                  'flex-1 rounded-xl bg-slate-900 px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60',
                  MYPAGE_FOCUS_RING,
                )}
              >
                {loading
                  ? t('mypage.reviews.write.submitting')
                  : isEdit
                    ? t('mypage.reviews.write.updateSubmit')
                    : t('mypage.reviews.write.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function WriteReviewPage() {
  const t = useTranslations();
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl">
          <div className={cn(MYPAGE_SURFACE_PAGE, 'p-6')}>
            <p className="text-[13px] text-slate-500" role="status" aria-live="polite">
              {t('mypage.common.loadingLabel')}
            </p>
          </div>
        </div>
      }
    >
      <WriteReviewContent />
    </Suspense>
  );
}
