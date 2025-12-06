'use client';

import { useState } from 'react';
import { CalendarDateIcon, StarIcon, TrashIcon } from '@/components/Icons';

interface Review {
  id: number;
  tour: string;
  tourId: number;
  rating: number;
  comment: string;
  date: string;
}

export default function ReviewsPage() {
  const [writtenReviews, setWrittenReviews] = useState<Review[]>([
    {
      id: 1,
      tour: 'Seoul City Tour',
      tourId: 1,
      rating: 5,
      comment: 'Amazing experience! The guide was very knowledgeable.',
      date: '2025-01-12',
    },
    {
      id: 2,
      tour: 'Jeju Island Adventure',
      tourId: 2,
      rating: 4,
      comment: 'Great tour, beautiful scenery.',
      date: '2024-12-22',
    },
  ]);

  const [canReview] = useState([
    { id: 1, tour: 'Busan Beach Tour', tourId: 3, date: '2025-01-05' },
    { id: 2, tour: 'DMZ Tour', tourId: 4, date: '2024-12-10' },
  ]);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTour, setSelectedTour] = useState<{ id: number; tour: string; tourId: number } | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  const handleWriteReview = (tour: { id: number; tour: string; tourId: number }) => {
    setSelectedTour(tour);
    setReviewForm({ rating: 5, comment: '' });
    setShowReviewModal(true);
  };

  const handleSubmitReview = () => {
    if (!selectedTour || !reviewForm.comment.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const newReview: Review = {
      id: writtenReviews.length + 1,
      tour: selectedTour.tour,
      tourId: selectedTour.tourId,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      date: new Date().toISOString().split('T')[0],
    };

    setWrittenReviews([...writtenReviews, newReview]);
    setShowReviewModal(false);
    alert('Review submitted successfully!');
  };

  const handleDeleteReview = (id: number) => {
    if (confirm('Are you sure you want to delete this review?')) {
      setWrittenReviews(writtenReviews.filter((review) => review.id !== id));
      alert('Review deleted successfully');
    }
  };

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
                      <h3 className="font-semibold text-gray-900">{review.tour}</h3>
                      <button
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
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
                    <p className="text-gray-600 mb-2">{review.comment}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <CalendarDateIcon className="w-4 h-4" />
                      {review.date}
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
                  <h3 className="font-semibold text-gray-900">{item.tour}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <CalendarDateIcon className="w-4 h-4" />
                    {item.date}
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

      {showReviewModal && selectedTour && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Write a Review</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tour</label>
              <p className="text-gray-900 font-semibold">{selectedTour.tour}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setReviewForm({ ...reviewForm, rating: i + 1 })}
                    className="focus:outline-none"
                  >
                    <StarIcon
                      className={`w-8 h-8 ${
                        i < reviewForm.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 fill-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                rows={4}
                placeholder="Share your experience..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

