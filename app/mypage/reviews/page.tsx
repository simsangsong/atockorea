'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDateIcon, StarIcon, TrashIcon, EditIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  tour_id: string;
  rating: number;
  comment: string | null;
  title: string | null;
  images: string[] | null;
  created_at: string;
  tours: {
    id: string;
    title: string;
  } | null;
}

interface CanReviewTour {
  id: string;
  tour_id: string;
  booking_date: string;
  tours: {
    id: string;
    title: string;
  } | null;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [writtenReviews, setWrittenReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState<CanReviewTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch user reviews
  useEffect(() => {
    fetchReviews();
  }, []);

  // Fetch can review tours after reviews are loaded
  useEffect(() => {
    if (writtenReviews.length >= 0) {
      fetchCanReviewTours();
    }
  }, [writtenReviews.length]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin');
        return;
      }

      const response = await fetch(`/api/reviews?userId=${session.user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews');
      }

      setWrittenReviews(data.reviews || []);
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCanReviewTours = async () => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        return;
      }

      // Fetch completed bookings that haven't been reviewed
      const response = await fetch(`/api/bookings?userId=${session.user.id}&status=completed`);
      const data = await response.json();

      if (response.ok && data.bookings) {
        // Get reviewed tour IDs
        const reviewedTourIds = writtenReviews.map(r => r.tour_id);
        
        // Filter out tours that already have reviews and remove duplicates
        const tourMap = new Map();
        data.bookings.forEach((booking: any) => {
          if (!reviewedTourIds.includes(booking.tour_id) && booking.tours) {
            if (!tourMap.has(booking.tour_id)) {
              tourMap.set(booking.tour_id, {
                id: booking.id,
                tour_id: booking.tour_id,
                booking_date: booking.booking_date || booking.created_at,
                tours: booking.tours,
              });
            }
          }
        });
        
        setCanReview(Array.from(tourMap.values()));
      }
    } catch (err: any) {
      console.error('Error fetching can review tours:', err);
    }
  };

  const handleWriteReview = (tour: { tour_id: string; tours: { title: string } | null }) => {
    const tourTitle = tour.tours?.title || 'Tour';
    router.push(`/mypage/reviews/write?tourId=${tour.tour_id}&tour=${encodeURIComponent(tourTitle)}`);
  };

  const handleEditReview = (review: Review) => {
    router.push(`/mypage/reviews/edit?id=${review.id}&tourId=${review.tour_id}`);
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) {
      return;
    }

    try {
      setDeletingId(id);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in to delete reviews');
        return;
      }

      const response = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete review');
      }

      // Remove from local state
      setWrittenReviews(writtenReviews.filter((review) => review.id !== id));
      alert('Review deleted successfully');
      
      // Refresh can review list
      fetchCanReviewTours();
    } catch (err: any) {
      console.error('Error deleting review:', err);
      alert(`Failed to delete review: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      router.push(path);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h1>
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h1>
        <p className="text-gray-600">Share your travel experiences</p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Reviews</h2>
        <div className="space-y-4">
          {writtenReviews.length > 0 ? (
            writtenReviews.map((review) => (
              <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/tour/${review.tour_id}`}
                        onClick={(e) => handleLinkClick(e, `/tour/${review.tour_id}`)}
                        className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                      >
                        {review.tours?.title || 'Tour'}
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditReview(review)}
                          className="text-indigo-600 hover:text-indigo-700 text-sm"
                          title="Edit review"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={deletingId === review.id}
                          className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
                          title="Delete review"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {review.title && (
                      <h3 className="font-semibold text-gray-800 mb-1">{review.title}</h3>
                    )}
                    <div className="flex items-center gap-0.5 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300 fill-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-gray-600 mb-2">{review.comment}</p>
                    )}
                    {review.images && review.images.length > 0 && (
                      <div className="flex gap-2 mb-2">
                        {review.images.slice(0, 3).map((image, idx) => (
                          <img
                            key={idx}
                            src={image}
                            alt={`Review image ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <CalendarDateIcon className="w-4 h-4" />
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No reviews yet</p>
          )}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Write a Review</h2>
        <div className="space-y-4">
          {canReview.length > 0 ? (
            canReview.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.tours?.title || 'Tour'}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <CalendarDateIcon className="w-4 h-4" />
                    {formatDate(item.booking_date)}
                  </p>
                </div>
                <button
                  onClick={() => handleWriteReview(item)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Write Review
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No tours available for review</p>
          )}
        </div>
      </div>
    </div>
  );
}
