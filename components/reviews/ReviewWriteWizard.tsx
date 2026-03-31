'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { mypagePageCard, MYPAGE_SUBTITLE, MYPAGE_TITLE } from '@/lib/mypage-ui';
import { uploadReviewImagesThroughApi } from '@/lib/review-upload-client';
import { reviewImageOptions } from '@/lib/file-upload';

type BookingRow = {
  id: string;
  tour_id: string;
  booking_date: string;
  tour_date?: string;
  status: string;
  tours: { id: string; title: string; city?: string; image_url?: string } | null;
};

type ReviewMineRow = {
  booking_id?: string | null;
};

const STEPS = 4;

function stepLabel(n: number): string {
  switch (n) {
    case 1:
      return 'Choose booking';
    case 2:
      return 'Rating';
    case 3:
      return 'Review & images';
    case 4:
      return 'Visibility & submit';
    default:
      return '';
  }
}

export type ReviewWriteWizardProps = {
  /** Deep-link from mybookings: pre-select this booking when eligible */
  initialBookingId?: string | null;
  /** Called after successful POST /api/reviews (before local success UI) */
  onSuccess?: () => void;
  /** Optional title override for shell */
  heading?: string;
};

export default function ReviewWriteWizard({
  initialBookingId = null,
  onSuccess,
  heading = 'Write a review',
}: ReviewWriteWizardProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null;

  const loadEligibility = useCallback(async (token: string, uid: string) => {
    setLoadingData(true);
    setDataError(null);
    try {
      const [bRes, rRes] = await Promise.all([
        fetch(`/api/bookings?userId=${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/reviews?userId=${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const bJson = await bRes.json().catch(() => ({}));
      const rJson = await rRes.json().catch(() => ({}));
      if (!bRes.ok) {
        throw new Error(typeof bJson.error === 'string' ? bJson.error : 'Failed to load bookings');
      }
      if (!rRes.ok) {
        throw new Error(typeof rJson.error === 'string' ? rJson.error : 'Failed to load reviews');
      }
      const allBookings: BookingRow[] = Array.isArray(bJson.bookings) ? bJson.bookings : [];
      const mine: ReviewMineRow[] = Array.isArray(rJson.reviews) ? rJson.reviews : [];
      const reviewed = new Set<string>();
      for (const r of mine) {
        if (r.booking_id && typeof r.booking_id === 'string') {
          reviewed.add(r.booking_id);
        }
      }
      const eligible = allBookings.filter(
        (b) => b.status === 'completed' && b.id && !reviewed.has(b.id),
      );
      setBookings(eligible);
    } catch (e: unknown) {
      setDataError(e instanceof Error ? e.message : 'Failed to load data');
      setBookings([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (cancelled) return;
      if (!session) {
        setAuthReady(true);
        setSessionToken(null);
        setUserId(null);
        setLoadingData(false);
        return;
      }
      setAuthReady(true);
      setSessionToken(session.access_token);
      setUserId(session.user.id);
      await loadEligibility(session.access_token, session.user.id);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadEligibility]);

  useEffect(() => {
    if (loadingData) return;
    if (step >= 2 && !selectedBookingId) {
      setStep(1);
    }
  }, [loadingData, step, selectedBookingId]);

  useEffect(() => {
    if (!initialBookingId || bookings.length === 0) return;
    const found = bookings.some((b) => b.id === initialBookingId);
    if (found) {
      setSelectedBookingId(initialBookingId);
      setStep(2);
    }
  }, [initialBookingId, bookings]);

  const refetchAfterSuccess = useCallback(async () => {
    if (!sessionToken || !userId) return;
    await loadEligibility(sessionToken, userId);
  }, [loadEligibility, sessionToken, userId]);

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !sessionToken) return;
    const remaining = (reviewImageOptions.maxFiles ?? 5) - imageUrls.length;
    if (remaining <= 0) {
      setUploadError(`You can add up to ${reviewImageOptions.maxFiles ?? 5} images.`);
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    setUploadError(null);
    setUploadingImages(true);
    try {
      const urls = await uploadReviewImagesThroughApi(picked, sessionToken);
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const removeImageAt = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const goNext = () => {
    setSubmitError(null);
    if (step === 1 && !selectedBookingId) {
      setSubmitError('Select a completed booking to review.');
      return;
    }
    if (step === 2 && !rating) {
      setSubmitError('Please choose a star rating.');
      return;
    }
    if (step === 3 && !comment.trim()) {
      setSubmitError('Please write your review.');
      return;
    }
    setStep((s) => Math.min(STEPS, s + 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!sessionToken || !selectedBookingId || !rating) return;
    if (!comment.trim()) {
      setSubmitError('Please write your review.');
      setStep(3);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        bookingId: selectedBookingId,
        rating,
        title: title.trim() ? title.trim() : null,
        comment: comment.trim() ? comment.trim() : null,
        images: imageUrls,
        is_anonymous: isAnonymous,
      };
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to submit review');
      }
      onSuccess?.();
      await refetchAfterSuccess();
      router.refresh();
      setSuccess(true);
      setStep(1);
      setSelectedBookingId(null);
      setRating(0);
      setTitle('');
      setComment('');
      setImageUrls([]);
      setIsAnonymous(false);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className={mypagePageCard('p-6')}>
        <p className={MYPAGE_SUBTITLE}>Loading…</p>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <div className={mypagePageCard('p-6')}>
        <h2 className={`${MYPAGE_TITLE} mb-2`}>{heading}</h2>
        <p className={`${MYPAGE_SUBTITLE} mb-4`}>Sign in to write a review for a completed tour.</p>
        <Link
          href="/signin?next=/reviews"
          className="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className={mypagePageCard('p-6 sm:p-8')}>
        <h2 className={`${MYPAGE_TITLE} mb-2`}>Thank you</h2>
        <p className={`${MYPAGE_SUBTITLE} mb-6`}>Your review was submitted.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/mypage/reviews"
            className="inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95"
          >
            My reviews
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              void refetchAfterSuccess();
            }}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={mypagePageCard('p-6 sm:p-8')}>
      <h2 className={`${MYPAGE_TITLE} mb-1`}>{heading}</h2>
      <p className={`${MYPAGE_SUBTITLE} mb-6`}>
        Step {step} of {STEPS}: {stepLabel(step)}
      </p>

      <div className="mb-6 flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-blue-600' : 'bg-slate-200'}`}
            aria-hidden
          />
        ))}
      </div>

      {dataError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dataError}</div>
      )}
      {(submitError || uploadError) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError || uploadError}
        </div>
      )}

      {loadingData ? (
        <p className={MYPAGE_SUBTITLE}>Loading your bookings…</p>
      ) : (
        <>
          {step === 1 && (
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No completed tours are waiting for a review right now. Completed bookings appear here after your tour
                  date.
                </p>
              ) : (
                <ul className="space-y-2">
                  {bookings.map((b: BookingRow) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          selectedBookingId === b.id
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-semibold text-slate-900">{b.tours?.title ?? 'Tour'}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {b.tours?.city ? `${b.tours.city} · ` : ''}
                          Booking #{b.id.slice(0, 8)}…
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 2 && selectedBooking && (
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">{selectedBooking.tours?.title ?? 'Tour'}</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                    aria-label={`${star} stars`}
                  >
                    <StarIcon
                      className={`h-10 w-10 transition-colors ${
                        star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && selectedBooking && (
            <div className="space-y-5">
              <div>
                <label htmlFor="rw-title" className="mb-2 block text-sm font-semibold text-slate-700">
                  Title <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="rw-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  maxLength={100}
                  placeholder="Short headline"
                />
              </div>
              <div>
                <label htmlFor="rw-comment" className="mb-2 block text-sm font-semibold text-slate-700">
                  Your review <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rw-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Share your experience…"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">{comment.length} characters</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Images <span className="font-normal text-slate-400">(optional, up to 5)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  disabled={uploadingImages || imageUrls.length >= (reviewImageOptions.maxFiles ?? 5)}
                  onChange={handleImageInput}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700"
                />
                {uploadingImages && <p className="mt-2 text-sm text-slate-500">Uploading…</p>}
                {imageUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {imageUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative">
                        <img
                          src={url}
                          alt={`Review image ${index + 1}`}
                          className="h-24 w-full rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImageAt(index)}
                          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white hover:bg-red-600"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && selectedBooking && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Tour: <span className="font-medium text-slate-900">{selectedBooking.tours?.title ?? 'Tour'}</span>
              </p>
              <p className="text-sm text-slate-600">
                Rating:{' '}
                <span className="font-medium text-slate-900">
                  {rating} / 5
                </span>
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  Post as <strong>Anonymous</strong>. When off, your profile name may be shown next to the review.
                </span>
              </label>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Back
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            onClick={goNext}
            disabled={loadingData || (step === 1 && bookings.length === 0)}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedBookingId}
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        )}
      </div>
    </div>
  );
}
