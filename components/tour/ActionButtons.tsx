'use client';

import { useState } from 'react';
import { HeartSolidIcon, HeartIcon } from '@/components/Icons';

interface ActionButtonsProps {
  onCheckAvailability: () => void;
  onShare: () => void;
}

export default function ActionButtons({ onCheckAvailability, onShare }: ActionButtonsProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 md:relative md:z-auto md:bottom-0 bg-white border-t border-gray-200 md:border-0 md:bg-transparent shadow-lg md:shadow-none">
      <div className="container mx-auto px-4 py-2 md:py-0 md:px-0">
        <div className="flex gap-2 md:flex-col md:gap-2">
          {/* Primary Action - Check Availability */}
          <button
            onClick={onCheckAvailability}
            className="flex-1 md:w-full px-4 py-2 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-center flex items-center justify-center"
          >
            Check Availability
          </button>

          {/* Secondary Actions */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="px-3 py-2 md:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center md:w-full"
            aria-label="Save to wishlist"
          >
            {isFavorite ? (
              <HeartSolidIcon className="w-5 h-5 text-red-500" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
            <span className="ml-1.5 md:hidden text-sm">Wishlist</span>
          </button>

          <button
            onClick={onShare}
            className="px-3 py-2 md:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center md:w-full"
            aria-label="Share tour"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="ml-1.5 md:hidden text-sm">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}

