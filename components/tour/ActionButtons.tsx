'use client';

import { useState, useEffect } from 'react';
import { HeartIcon, HeartSolidIcon, ShareIcon } from '@/components/Icons';
import { isInWishlist, toggleWishlist } from '@/lib/wishlist';
import { useRouter } from 'next/navigation';

interface ActionButtonsProps {
  tourId: string;
  onCheckAvailability: () => void;
  onShare: () => void;
  /** When true, render only wishlist + share icons (e.g. for hero overlay) */
  compact?: boolean;
  /** For compact mode: use 'overlay' for white icons on dark background */
  variant?: 'default' | 'overlay';
}

export default function ActionButtons({ tourId, onCheckAvailability, onShare, compact, variant = 'default' }: ActionButtonsProps) {
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

  const isOverlay = variant === 'overlay';
  const btnClass = compact && isOverlay
    ? 'p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white'
    : 'px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center flex-1 md:w-full border border-gray-200';

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleWishlistToggle}
          disabled={checking || loading}
          className={`${btnClass} disabled:opacity-50 flex-shrink-0`}
          aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
        >
          {checking || loading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
          ) : isFavorite ? (
            <HeartSolidIcon className={`w-5 h-5 ${isOverlay ? 'text-red-300' : 'text-red-500'}`} />
          ) : (
            <HeartIcon className="w-5 h-5" />
          )}
        </button>
        <button onClick={onShare} className={btnClass} aria-label="Share tour">
          <ShareIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 md:relative md:z-auto md:bottom-0 bg-white border-t border-gray-100 md:border-0 md:bg-transparent shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:shadow-none">
      <div className="container mx-auto px-4 py-2 md:py-0 md:px-0">
        <div className="flex gap-2 md:flex-col md:gap-2">
          <button
            onClick={onCheckAvailability}
            className="flex-1 md:w-full px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors text-center flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Check Availability
          </button>
          <div className="flex gap-2 md:w-full">
            <button
              onClick={handleWishlistToggle}
              disabled={checking || loading}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center justify-center flex-1 md:w-full disabled:opacity-50 border border-gray-100"
              aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
            >
              {checking || loading ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : isFavorite ? (
                <HeartSolidIcon className="w-4 h-4 text-red-500" />
              ) : (
                <HeartIcon className="w-4 h-4" />
              )}
              <span className="ml-1.5 md:hidden text-xs font-medium">Wishlist</span>
            </button>
            <button
              onClick={onShare}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors flex items-center justify-center flex-1 md:w-full border border-gray-100"
              aria-label="Share tour"
            >
              <ShareIcon className="w-4 h-4" />
              <span className="ml-1.5 md:hidden text-xs font-medium">Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
