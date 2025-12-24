'use client';

import { useState, useEffect } from 'react';
import { HeartIcon, HeartSolidIcon, ShareIcon } from '@/components/Icons';
import { isInWishlist, toggleWishlist } from '@/lib/wishlist';
import { useRouter } from 'next/navigation';

interface ActionButtonsProps {
  tourId: string;
  onCheckAvailability: () => void;
  onShare: () => void;
}

export default function ActionButtons({ tourId, onCheckAvailability, onShare }: ActionButtonsProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkWishlistStatus();
  }, [tourId]);

  const checkWishlistStatus = async () => {
    try {
      setChecking(true);
      const status = await isInWishlist(tourId);
      setIsFavorite(status);
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleWishlistToggle = async () => {
    try {
      setLoading(true);
      const result = await toggleWishlist(tourId, isFavorite);
      
      if (result.success) {
        setIsFavorite(result.isInWishlist);
      } else {
        if (result.error?.includes('sign in')) {
          router.push('/signin?redirect=' + window.location.pathname);
        } else {
          alert(result.error || 'Failed to update wishlist');
        }
      }
    } catch (error: any) {
      console.error('Error toggling wishlist:', error);
      alert('Failed to update wishlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 md:relative md:z-auto md:bottom-0 bg-white border-t-2 border-gray-200 md:border-0 md:bg-transparent shadow-xl md:shadow-none">
      <div className="container mx-auto px-4 py-3 md:py-0 md:px-0">
        <div className="flex gap-3 md:flex-col md:gap-3">
          {/* Primary Action - Check Availability */}
          <button
            onClick={onCheckAvailability}
            className="flex-1 md:w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-center flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Check Availability
          </button>

          {/* Secondary Actions */}
          <div className="flex gap-2 md:w-full">
            <button
              onClick={handleWishlistToggle}
              disabled={checking || loading}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center justify-center flex-1 md:w-full disabled:opacity-50 border border-gray-200"
              aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
            >
              {checking || loading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : isFavorite ? (
                <HeartSolidIcon className="w-5 h-5 text-red-500" />
              ) : (
                <HeartIcon className="w-5 h-5" />
              )}
              <span className="ml-2 md:hidden text-sm font-medium">Wishlist</span>
            </button>

            <button
              onClick={onShare}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center justify-center flex-1 md:w-full border border-gray-200"
              aria-label="Share tour"
            >
              <ShareIcon className="w-5 h-5" />
              <span className="ml-2 md:hidden text-sm font-medium">Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
