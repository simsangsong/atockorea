'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { HeartSolidIcon, MapIcon, ClockIcon, StarIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';

interface WishlistItem {
  id: string;
  tour_id: string;
  created_at: string;
  tours: {
    id: string;
    title: string;
    city: string;
    price: number;
    original_price?: number | null;
    price_type: string;
    image_url: string;
    images?: string[];
    rating?: number;
    review_count?: number;
    duration?: string;
  } | null;
}

export default function WishlistPage() {
  const router = useRouter();
  const t = useTranslations();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        router.push('/signin?redirect=/mypage/wishlist');
        return;
      }

      const response = await fetch('/api/wishlist', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/mypage/wishlist');
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch wishlist');
      }

      const data = await response.json();
      setWishlistItems(data.wishlist || []);
    } catch (err: any) {
      console.error('Error fetching wishlist:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tourId: string, wishlistId: string) => {
    if (!confirm('Remove this tour from your wishlist?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert('Please sign in to manage wishlist');
        return;
      }

      const response = await fetch(`/api/wishlist?tourId=${tourId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove from wishlist');
      }

      setWishlistItems(wishlistItems.filter((item) => item.id !== wishlistId));
    } catch (err: any) {
      console.error('Error removing from wishlist:', err);
      alert(`Failed to remove from wishlist: ${err.message}`);
    }
  };

  const getImageUrl = (item: WishlistItem) => {
    if (item.tours?.image_url) return item.tours.image_url;
    if (item.tours?.images && item.tours.images.length > 0) {
      return Array.isArray(item.tours.images) ? item.tours.images[0] : item.tours.images;
    }
    return 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400';
  };

  const getPrice = (item: WishlistItem) => {
    const price = parseFloat(item.tours?.price?.toString() || '0');
    return price.toFixed(2);
  };

  const getOriginalPrice = (item: WishlistItem) => {
    if (!item.tours?.original_price) return null;
    const price = parseFloat(item.tours.original_price.toString());
    return price.toFixed(2);
  };

  const getDiscountPercent = (item: WishlistItem) => {
    if (!item.tours?.original_price || !item.tours?.price) return 0;
    const original = parseFloat(item.tours.original_price.toString());
    const current = parseFloat(item.tours.price.toString());
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading wishlist...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchWishlist}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Wishlist</h1>
        <p className="text-gray-600">
          {wishlistItems.length} {wishlistItems.length === 1 ? 'tour' : 'tours'} saved
        </p>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
          <HeartSolidIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('wishlist.empty')}</h2>
          <p className="text-gray-600 mb-6">{t('wishlist.emptyDescription')}</p>
          <Link
            href="/tours"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            {t('wishlist.browseTours')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistItems.map((item) => {
            const discountPercent = getDiscountPercent(item);
            const originalPrice = getOriginalPrice(item);

            return (
              <div
                key={item.id}
                className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="h-48 relative group">
                  <Link href={`/tour/${item.tour_id}`}>
                    <Image 
                      src={getImageUrl(item)} 
                      alt={item.tours?.title || 'Tour'} 
                      fill 
                      className="object-cover cursor-pointer" 
                    />
                  </Link>
                  {discountPercent > 0 && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-md">
                      {discountPercent}% OFF
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(item.tour_id, item.id)}
                    className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('wishlist.remove')}
                  >
                    <HeartSolidIcon className="w-5 h-5 text-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <Link href={`/tour/${item.tour_id}`}>
                    <h3 className="font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors line-clamp-2">
                      {item.tours?.title || 'Tour'}
                    </h3>
                  </Link>
                  
                  {/* Location and Duration */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
                    {item.tours?.city && (
                      <div className="flex items-center gap-1">
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>{item.tours.city}</span>
                      </div>
                    )}
                    {item.tours?.duration && (
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{item.tours.duration}</span>
                      </div>
                    )}
                  </div>

                  {/* Rating */}
                  {item.tours?.rating && item.tours.rating > 0 && (
                    <div className="flex items-center gap-1 mb-3">
                      <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {item.tours.rating.toFixed(1)}
                      </span>
                      {item.tours.review_count && item.tours.review_count > 0 && (
                        <span className="text-xs text-gray-500">
                          ({item.tours.review_count})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-baseline gap-2">
                      {originalPrice && (
                        <span className="text-sm text-gray-400 line-through">
                          ${originalPrice}
                        </span>
                      )}
                      <span className="text-xl font-bold text-indigo-600">
                        ${getPrice(item)}
                      </span>
                      <span className="text-xs text-gray-500">
                        / {item.tours?.price_type || 'person'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/tour/${item.tour_id}`}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium text-center"
                    >
                      {t('wishlist.viewDetails')}
                    </Link>
                    <button
                      onClick={() => handleRemove(item.tour_id, item.id)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                      title={t('wishlist.remove')}
                    >
                      <HeartSolidIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
