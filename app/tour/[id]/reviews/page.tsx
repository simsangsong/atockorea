'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReviewList from '@/components/reviews/ReviewList';
import ReviewForm from '@/components/reviews/ReviewForm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TourReviewsPage() {
  const params = useParams();
  const tourId = params?.id as string;
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userBookingId, setUserBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (tourId) {
      fetchReviews();
      checkUserBooking();
    }
  }, [tourId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews?tourId=${tourId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserBooking = async () => {
    try {
      // Check if user has a completed booking for this tour
      const response = await fetch(`/api/bookings?tourId=${tourId}&status=completed`);
      if (response.ok) {
        const data = await response.json();
        if (data.bookings && data.bookings.length > 0) {
          // Check if user already reviewed
          const reviewedResponse = await fetch(`/api/reviews?tourId=${tourId}`);
          if (reviewedResponse.ok) {
            const reviewedData = await reviewedResponse.json();
            const userReviewed = reviewedData.reviews?.some((r: any) => r.userId === data.bookings[0].user_id);
            if (!userReviewed) {
              setUserBookingId(data.bookings[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking user booking:', error);
    }
  };

  const handleReviewSubmit = async (reviewData: {
    rating: number;
    title: string;
    comment: string;
    photos: string[];
  }) => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tourId,
          bookingId: userBookingId,
          ...reviewData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit review');
      }

      const data = await response.json();
      setReviews([data.review, ...reviews]);
      setShowForm(false);
      alert('评价提交成功！');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('提交失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">客户评价</h1>

          {/* Write Review Button */}
          {!showForm && (
            <div className="mb-6">
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                写评价
              </button>
            </div>
          )}

          {/* Review Form */}
          {showForm && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">写评价</h2>
              <ReviewForm
                tourId={tourId}
                bookingId={userBookingId || undefined}
                onSubmit={handleReviewSubmit}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {/* Reviews List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : (
            <ReviewList
              reviews={reviews}
              tourId={tourId}
              onReviewSubmit={fetchReviews}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

