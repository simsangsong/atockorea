'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Review {
  id: string;
  author: string;
  avatar: string | null;
  rating: number;
  title: string;
  text: string;
  photos: string[];
  isVerified: boolean;
  isAnonymous: boolean;
  date: string;
  likeCount?: number;
  dislikeCount?: number;
  userReaction?: 'like' | 'dislike' | null;
}

interface ReviewListProps {
  reviews: Review[];
  tourId: string;
  onReviewSubmit?: () => void;
}

export default function ReviewList({ reviews, tourId, onReviewSubmit }: ReviewListProps) {
  const [sortBy, setSortBy] = useState<'latest' | 'highest' | 'lowest' | 'photos' | 'popular'>('latest');
  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ [key: string]: { likeCount: number; dislikeCount: number; userReaction: 'like' | 'dislike' | null } }>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch reactions on mount
  useEffect(() => {
    const fetchReactions = async () => {
      try {
        // Get current user ID (you may need to adjust this based on your auth setup)
        const userId = localStorage.getItem('user_id') || null;
        setCurrentUserId(userId);

        // Fetch reactions for all reviews
        const reactionPromises = reviews.map(async (review) => {
          const response = await fetch(`/api/reviews/reactions?reviewId=${review.id}${userId ? `&userId=${userId}` : ''}`);
          if (response.ok) {
            const data = await response.json();
            return { reviewId: review.id, ...data };
          }
          return { reviewId: review.id, likeCount: 0, dislikeCount: 0, userReaction: null };
        });

        const reactionsData = await Promise.all(reactionPromises);
        const reactionsMap: typeof reactions = {};
        reactionsData.forEach((data) => {
          reactionsMap[data.reviewId] = {
            likeCount: data.likeCount,
            dislikeCount: data.dislikeCount,
            userReaction: data.userReaction,
          };
        });
        setReactions(reactionsMap);
      } catch (error) {
        console.error('Error fetching reactions:', error);
      }
    };

    if (reviews.length > 0) {
      fetchReactions();
    }
  }, [reviews]);

  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortBy === 'highest') {
      return b.rating - a.rating;
    } else if (sortBy === 'lowest') {
      return a.rating - b.rating;
    } else if (sortBy === 'popular') {
      // 按点赞量排序
      const aLikes = reactions[a.id]?.likeCount || a.likeCount || 0;
      const bLikes = reactions[b.id]?.likeCount || b.likeCount || 0;
      return bLikes - aLikes;
    } else {
      // Photos first
      if (a.photos.length > 0 && b.photos.length === 0) return -1;
      if (a.photos.length === 0 && b.photos.length > 0) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  const displayReviews = showAll ? sortedReviews : sortedReviews.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">客户评价</h2>
          <p className="text-sm text-gray-600 mt-1">
            共 {reviews.length} 条评价
          </p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        >
          <option value="latest">最新</option>
          <option value="highest">评分最高</option>
          <option value="lowest">评分最低</option>
          <option value="popular">最受欢迎</option>
          <option value="photos">有照片优先</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {displayReviews.map((review) => (
          <div
            key={review.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {review.avatar ? (
                  <Image
                    src={review.avatar}
                    alt={review.author}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 font-semibold text-lg">
                      {review.author.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">
                        {review.isAnonymous ? '匿名用户' : review.author}
                      </h4>
                      {review.isVerified && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          已验证购买
                        </span>
                      )}
                      {review.photos.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          有照片 ({review.photos.length})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300 fill-gray-300'
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                  </div>
                </div>

                {review.title && (
                  <h5 className="font-semibold text-gray-900 mb-2">{review.title}</h5>
                )}

                <p className="text-gray-700 mb-3 whitespace-pre-wrap">{review.text}</p>

                {/* Photos */}
                {review.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4">
                    {review.photos.slice(0, 4).map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImage(photo)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-500 transition-colors group"
                      >
                        <Image
                          src={photo}
                          alt={`Review photo ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                            />
                          </svg>
                        </div>
                      </button>
                    ))}
                    {review.photos.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(review.photos[4])}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-500 transition-colors bg-gray-100 flex items-center justify-center"
                      >
                        <span className="text-gray-600 font-semibold">
                          +{review.photos.length - 4}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More */}
      {reviews.length > 5 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          查看更多评价 ({reviews.length - 5} 条)
        </button>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <Image
              src={selectedImage}
              alt="Review photo"
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

