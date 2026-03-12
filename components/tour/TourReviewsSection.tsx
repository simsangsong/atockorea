'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';

export interface ReviewItem {
  id: string;
  tour_id: string;
  user_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  is_anonymous: boolean;
  is_verified: boolean;
  created_at: string;
  user_profiles?: { id: string | null; full_name: string | null; avatar_url: string | null } | null;
}

interface TourReviewsSectionProps {
  tourId: string;
  tourTitle?: string;
  className?: string;
}

function StarRating({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={value >= star ? 'text-amber-400' : 'text-gray-200'}>
          <svg className={s} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
        </span>
      ))}
    </div>
  );
}

export default function TourReviewsSection({ tourId, tourTitle, className = '' }: TourReviewsSectionProps) {
  const t = useTranslations();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?tourId=${encodeURIComponent(tourId)}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reviews');
      setReviews(data.reviews || []);
    } catch (e) {
      console.error(e);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('tour.reviews')}
          {reviews.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">({reviews.length})</span>
          )}
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm rounded-2xl bg-gray-50/80 border border-gray-100">
          {t('tour.noReviewsYet')}
        </div>
      ) : (
        <ul className="space-y-5">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-gray-200/60 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {review.is_anonymous ? (
                    <span className="text-gray-400 text-lg font-medium">?</span>
                  ) : review.user_profiles?.avatar_url ? (
                    <Image src={review.user_profiles.avatar_url} alt="" width={40} height={40} className="object-cover" />
                  ) : (
                    <span className="text-gray-500 text-sm font-medium">
                      {(review.user_profiles?.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {review.is_anonymous ? 'Anonymous' : (review.user_profiles?.full_name || 'Guest')}
                    </span>
                    {review.is_verified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Verified</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="mt-1">
                    <StarRating value={review.rating} size="sm" />
                  </div>
                  {review.title && <p className="mt-1 text-sm font-medium text-gray-800">{review.title}</p>}
                  {review.comment && <p className="mt-1 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{review.comment}</p>}
                  {review.images && review.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.images.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90">
                          <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
