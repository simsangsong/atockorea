'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import {
  AUTH_CHECKBOX,
  AUTH_FIELD_LABEL,
  AUTH_INPUT,
  MYPAGE_FOCUS_RING,
  MYPAGE_SECTION_TITLE,
  MYPAGE_SUBTITLE,
  MYPAGE_SURFACE_PAGE,
  MYPAGE_TITLE,
  mypageCard,
} from '@/lib/mypage-ui';
import { cn } from '@/lib/utils';
import { uploadReviewImagesThroughApi } from '@/lib/review-upload-client';
import { reviewImageOptions } from '@/lib/file-upload';
import {
  isReviewWriteWindowBypassEmail,
  isReviewWriteWindowOpenForViewer,
  isTourDateOnOrBeforeSeoulToday,
  normalizeBookingTourDateYmd,
} from '@/lib/review-write-window';

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

/** Stable id for the mock booking in `sandbox` mode (deep links / preview page). */
export const REVIEW_WRITE_SANDBOX_BOOKING_ID = 'sandbox-booking-demo';

const SANDBOX_BOOKINGS: BookingRow[] = [
  {
    id: REVIEW_WRITE_SANDBOX_BOOKING_ID,
    tour_id: 'sandbox-tour-jeju-demo',
    booking_date: '2026-03-01',
    tour_date: '2026-03-10',
    status: 'completed',
    tours: {
      id: 'sandbox-tour-jeju-demo',
      title: '[Sandbox] Jeju East Coast Small-Group Tour',
      city: 'Jeju',
    },
  },
];

const STEPS = 4;

const premiumIconShell =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)]';

/** Matches checkout / home planner elevated panels — white card + warm hairline. */
function WizardOuterCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        MYPAGE_SURFACE_PAGE,
        'relative overflow-hidden',
        'before:pointer-events-none before:absolute before:inset-x-12 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-300/40 before:to-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}

const primaryCtaClass = cn(
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-semibold text-white transition-all outline-none disabled:pointer-events-none disabled:opacity-50',
  'border-none bg-gradient-to-b from-[#1e3a5f] to-[#172d4a] shadow-[var(--home-shadow-btn-primary)]',
  'hover:opacity-[0.97] focus-visible:ring-2 focus-visible:ring-slate-900/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  MYPAGE_FOCUS_RING,
);

const secondaryCtaClass = cn(
  'inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-[14px] font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50',
  MYPAGE_FOCUS_RING,
);

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
  /**
   * Mock flow: fake booking, no auth, no API submit. For `/reviews/preview` local UX checks only.
   */
  sandbox?: boolean;
};

export default function ReviewWriteWizard({
  initialBookingId = null,
  onSuccess,
  heading = 'Write a review',
  sandbox = false,
}: ReviewWriteWizardProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

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

  const loadEligibility = useCallback(async (token: string, uid: string, email: string | null) => {
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
      const eligible = allBookings.filter((b) => {
        if (!b.id || reviewed.has(b.id)) return false;
        const ymd = normalizeBookingTourDateYmd(b.tour_date || null);
        if (!ymd) return false;
        if (b.status === 'completed') {
          return isReviewWriteWindowOpenForViewer(ymd, email);
        }
        if (isReviewWriteWindowBypassEmail(email) && b.status === 'confirmed') {
          return isTourDateOnOrBeforeSeoulToday(ymd);
        }
        return false;
      });
      setBookings(eligible);
    } catch (e: unknown) {
      setDataError(e instanceof Error ? e.message : 'Failed to load data');
      setBookings([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (sandbox) {
      setAuthReady(true);
      setSessionToken(null);
      setUserId(null);
      setViewerEmail(null);
      setBookings(SANDBOX_BOOKINGS);
      setLoadingData(false);
      setDataError(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (cancelled) return;
      if (!session) {
        setAuthReady(true);
        setSessionToken(null);
        setUserId(null);
        setViewerEmail(null);
        setLoadingData(false);
        return;
      }
      setAuthReady(true);
      setSessionToken(session.access_token);
      setUserId(session.user.id);
      const email = session.user.email ?? null;
      setViewerEmail(email);
      await loadEligibility(session.access_token, session.user.id, email);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [sandbox, loadEligibility]);

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
    if (sandbox) {
      setBookings([...SANDBOX_BOOKINGS]);
      return;
    }
    if (!sessionToken || !userId) return;
    await loadEligibility(sessionToken, userId, viewerEmail);
  }, [sandbox, loadEligibility, sessionToken, userId, viewerEmail]);

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (sandbox) {
      setUploadError('Image upload is disabled in sandbox mode.');
      e.target.value = '';
      return;
    }
    if (!sessionToken) return;
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
      setSubmitError(sandbox ? 'Select the sandbox booking to continue.' : 'Select a completed booking to review.');
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
    if (!selectedBookingId || !rating) return;
    if (!comment.trim()) {
      setSubmitError('Please write your review.');
      setStep(3);
      return;
    }

    if (sandbox) {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await new Promise((r) => setTimeout(r, 450));
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
      return;
    }

    if (!sessionToken) return;

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
      <WizardOuterCard className="p-6 sm:p-8">
        <p className={MYPAGE_SUBTITLE}>Loading…</p>
      </WizardOuterCard>
    );
  }

  if (!sandbox && !sessionToken) {
    return (
      <WizardOuterCard className="p-6 sm:p-8">
        <h2 className={`${MYPAGE_TITLE} mb-1 text-xl tracking-tight text-slate-950 sm:text-2xl`}>{heading}</h2>
        <p className={`${MYPAGE_SUBTITLE} mb-6 max-w-md`}>Sign in to write a review for a completed tour.</p>
        <Link href="/signin?next=/reviews" className={cn(primaryCtaClass, 'w-full sm:w-auto')}>
          Sign in
        </Link>
      </WizardOuterCard>
    );
  }

  if (success) {
    return (
      <WizardOuterCard className="p-6 sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className={premiumIconShell} aria-hidden>
            <StarIcon className="h-5 w-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Thank you</h2>
            <p className={`${MYPAGE_SUBTITLE} mt-2 max-w-md`}>
              {sandbox ? 'Sandbox complete — nothing was saved.' : 'Your review was submitted.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {!sandbox ? (
            <Link href="/mypage/reviews" className={cn(primaryCtaClass, 'w-full sm:w-auto')}>
              My reviews
            </Link>
          ) : (
            <Link href="/reviews" className={cn(primaryCtaClass, 'w-full sm:w-auto')}>
              Back to reviews
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setSuccess(false);
              void refetchAfterSuccess();
            }}
            className={secondaryCtaClass}
          >
            Write another
          </button>
        </div>
      </WizardOuterCard>
    );
  }

  return (
    <WizardOuterCard className="p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className={premiumIconShell} aria-hidden>
          <StarIcon className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{heading}</h2>
          <p className={`${MYPAGE_SUBTITLE} mt-1`}>
            Step {step} of {STEPS}: {stepLabel(step)}
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              n <= step
                ? 'bg-gradient-to-r from-[#1e3a5f] to-[#172d4a] shadow-[0_2px_8px_-2px_rgba(23,45,74,0.35)]'
                : 'bg-slate-200/90',
            )}
            aria-hidden
          />
        ))}
      </div>

      {dataError && (
        <div className="mb-4 rounded-2xl border border-red-200/90 bg-red-50/90 p-4 text-[13px] leading-snug text-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          {dataError}
        </div>
      )}
      {(submitError || uploadError) && (
        <div className="mb-4 rounded-2xl border border-red-200/90 bg-red-50/90 p-4 text-[13px] leading-snug text-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
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
                <p className="text-[13px] leading-relaxed text-slate-600">
                  {isReviewWriteWindowBypassEmail(viewerEmail) ? (
                    <>
                      No bookings are available to review yet. You need a <strong>completed</strong> tour (or, for your
                      admin account only, a <strong>confirmed</strong> booking whose tour date is today or earlier in
                      Korea). Future tour dates do not appear here.
                    </>
                  ) : (
                    <>
                      No completed tours are waiting for a review right now. Completed bookings appear here once your
                      tour date has arrived and the review window is open (from 1:00 PM Korea time on the tour day, or
                      after).
                    </>
                  )}
                </p>
              ) : (
                <ul className="space-y-3">
                  {bookings.map((b: BookingRow) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className={cn(
                          'w-full rounded-2xl border px-4 py-4 text-left transition-all text-[13px]',
                          selectedBookingId === b.id
                            ? 'border-slate-900/20 bg-gradient-to-b from-white to-slate-50/95 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.22)] ring-2 ring-slate-900/12'
                            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.08)]',
                          MYPAGE_FOCUS_RING,
                        )}
                      >
                        <span className="font-semibold text-slate-900">{b.tours?.title ?? 'Tour'}</span>
                        <span className="mt-1 block text-[12px] text-slate-500">
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
            <div className={cn(mypageCard('p-4 sm:p-5'), 'border border-slate-200/70')}>
              <p className={cn(MYPAGE_SECTION_TITLE, 'mb-4')}>{selectedBooking.tours?.title ?? 'Tour'}</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className={cn('rounded-lg focus:outline-none', MYPAGE_FOCUS_RING)}
                    aria-label={`${star} stars`}
                  >
                    <StarIcon
                      className={cn(
                        'h-10 w-10 transition-colors',
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'fill-slate-200 text-slate-200',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && selectedBooking && (
            <div className="space-y-6">
              <div>
                <label htmlFor="rw-title" className={AUTH_FIELD_LABEL}>
                  Title <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="rw-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={AUTH_INPUT}
                  maxLength={100}
                  placeholder="Short headline"
                />
              </div>
              <div>
                <label htmlFor="rw-comment" className={AUTH_FIELD_LABEL}>
                  Your review <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="rw-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={6}
                  className={AUTH_INPUT}
                  placeholder="Share your experience…"
                  required
                />
                <p className="mt-2 text-[12px] text-slate-500">{comment.length} characters</p>
              </div>
              <div>
                <label className={AUTH_FIELD_LABEL}>
                  Images <span className="font-normal text-slate-400">(optional, up to 5)</span>
                </label>
                {sandbox ? (
                  <p className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
                    Preview only: uploads are off here. On the live review page (signed in, not sandbox), photos upload
                    normally after you pick files.
                  </p>
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  disabled={
                    sandbox ||
                    uploadingImages ||
                    imageUrls.length >= (reviewImageOptions.maxFiles ?? 5)
                  }
                  onChange={handleImageInput}
                  className={cn(
                    AUTH_INPUT,
                    'cursor-pointer py-3 text-[13px] file:mr-4 file:cursor-pointer file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-white file:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.35)]',
                  )}
                />
                {uploadingImages && <p className="mt-2 text-[13px] text-slate-500">Uploading…</p>}
                {imageUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {imageUrls.map((url, index) => (
                      <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200/80 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.2)]">
                        <img
                          src={url}
                          alt={`Review image ${index + 1}`}
                          className="h-24 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImageAt(index)}
                          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/90 text-sm font-bold text-white shadow-md transition hover:bg-slate-950"
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
            <div className={cn(mypageCard('p-4 sm:p-5'), 'space-y-4 border border-slate-200/70')}>
              <p className="text-[13px] text-slate-600">
                Tour:{' '}
                <span className="font-semibold text-slate-900">{selectedBooking.tours?.title ?? 'Tour'}</span>
              </p>
              <p className="text-[13px] text-slate-600">
                Rating: <span className="font-semibold text-slate-900">{rating} / 5</span>
              </p>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition-colors hover:bg-slate-50/90',
                  MYPAGE_FOCUS_RING,
                )}
              >
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className={AUTH_CHECKBOX}
                />
                <span className="text-[13px] leading-snug text-slate-700">
                  Post as <strong className="text-slate-900">Anonymous</strong>. When off, your profile name may be shown
                  next to the review.
                </span>
              </label>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200/70 pt-6">
        {step > 1 && (
          <button type="button" onClick={goBack} disabled={submitting} className={secondaryCtaClass}>
            Back
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            onClick={goNext}
            disabled={loadingData || (step === 1 && bookings.length === 0)}
            className={cn(primaryCtaClass, 'disabled:cursor-not-allowed')}
          >
            Next
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedBookingId}
            className={cn(primaryCtaClass, 'disabled:cursor-not-allowed')}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        )}
      </div>
    </WizardOuterCard>
  );
}
