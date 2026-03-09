'use client';

// Force dynamic rendering for safety with Supabase/i18n
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDateIcon, StarIcon } from '@/components/Icons';
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

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <h1 className="text-xl font-medium text-gray-900 mb-2">My Reviews</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <h1 className="text-xl font-medium text-gray-900 mb-2">My Reviews</h1>
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-xl font-medium text-gray-900 mb-2">My Reviews</h1>
        <p className="text-gray-600">
          You can write new reviews from your completed bookings. Existing reviews are shown below and cannot be edited or deleted.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-4">You have not written any reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <Link
                      href={`/tour/${review.tour_id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {review.tours?.title || 'Tour'}
                    </Link>
                    <div className="flex items-center gap-0.5 mt-1 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {review.title && (
                      <h3 className="font-medium text-gray-800 mb-1">{review.title}</h3>
                    )}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

