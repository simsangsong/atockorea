'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';

export default function EditReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewId = searchParams?.get('id');
  const tourId = searchParams?.get('tourId');

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) {
      router.push('/mypage/reviews');
      return;
    }
    fetchReview();
  }, [reviewId, router]);

  const fetchReview = async () => {
    try {
      setFetching(true);
      const response = await fetch(`/api/reviews/${reviewId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch review');
      }

      const review = data.review;
      setRating(review.rating);
      setTitle(review.title || '');
      setComment(review.comment || '');
      setImages(review.images || []);
    } catch (err: any) {
      console.error('Error fetching review:', err);
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      if (!session) {
        alert('Please sign in to upload images');
        return;
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reviews/${fileName}`;

        const uploadResult = await supabase?.storage
          .from('reviews')
          .upload(filePath, file);
        
        if (!uploadResult || uploadResult.error) {
          throw new Error(uploadResult?.error?.message || 'Failed to upload image');
        }
        
        const { data } = uploadResult;

        const { data: { publicUrl } } = supabase?.storage
          .from('reviews')
          .getPublicUrl(filePath) || { data: { publicUrl: null } };

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages([...images, ...uploadedUrls.filter(url => url !== null) as string[]]);
    } catch (err: any) {
      console.error('Error uploading images:', err);
      alert(`Failed to upload images: ${err.message}`);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      setError('Please select a rating');
      return;
    }

    if (!comment.trim()) {
      setError('Please write a comment');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in to edit a review');
        router.push('/signin');
        return;
      }

      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rating,
          title: title.trim() || null,
          comment: comment.trim(),
          images: images.length > 0 ? images : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update review');
      }

      alert('Review updated successfully!');
      router.push('/mypage/reviews');
    } catch (err: any) {
      console.error('Error updating review:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <p className="text-gray-600">Loading review...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Review</h1>
        <p className="text-gray-600 mb-6">Update your review</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none"
                >
                  <StarIcon
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 fill-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Review Title (Optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Give your review a title"
              maxLength={100}
            />
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Your Review <span className="text-red-500">*</span>
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Share your experience..."
              required
            />
            <p className="mt-1 text-sm text-gray-500">{comment.length} characters</p>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image}
                      alt={`Review ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rating || !comment.trim()}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

