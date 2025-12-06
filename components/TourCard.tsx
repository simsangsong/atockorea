"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./Icons";

// Export Tour type for use in other files
export interface Tour {
  slug: string;
  city: string;
  tag: string;
  title: string;
  desc: string;
  price: string;
  href: string;
}

interface TourCardProps {
  id?: number;
  title?: string; // Optional when tour is provided
  location?: string;
  type?: string;
  duration?: string;
  price?: number;
  priceType?: "person" | "group";
  image?: string;
  badge?: string;
  rating?: number;
  reviewCount?: number;
  // Support for Tour type
  tour?: Tour;
}

export default function TourCard({
  id,
  title,
  location,
  type,
  duration,
  price,
  priceType,
  image,
  badge,
  rating = 4.5,
  reviewCount = 0,
  tour,
}: TourCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  // Support both Tour type and individual props
  const displayTitle = tour?.title || title || "";
  const displayLocation = tour?.city || location || "";
  const displayType = tour?.desc || type || "";
  const displayPrice = tour?.price || (price ? `from US$${price}` : "");
  const displayHref = tour?.href || `/tour/${id || 1}`;
  const displayImage = image || "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsAdding(false);
      alert(`${displayTitle} added to cart!`);
      // In production, add to cart state/API
    }, 500);
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-white/60 group h-full">
      <Link href={displayHref} className="block">
        <div className="relative h-36 sm:h-40 overflow-hidden shadow-inner">
          <Image
            src={displayImage}
            alt={displayTitle}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          {badge && (
            <div className="absolute top-2 left-2">
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-semibold rounded-full shadow-lg drop-shadow-md">
                {badge}
              </span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <Link href={displayHref}>
          <div className="mb-2.5">
            <h3 className="font-semibold text-gray-800 mb-1.5 line-clamp-2 text-base sm:text-lg leading-tight hover:text-indigo-600 transition-colors">
              {displayTitle}
            </h3>
            <p className="text-sm text-gray-500 mb-2">{displayLocation}</p>
          </div>
        </Link>
        
        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 ml-0.5">{rating}</span>
          </div>
          {reviewCount > 0 && (
            <span className="text-sm text-gray-400">({reviewCount})</span>
          )}
        </div>
        
        {displayType && (
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {displayType}
            </span>
            {duration && (
              <>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {duration}
                </span>
              </>
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <p className="text-lg sm:text-xl font-bold text-indigo-600">
              {displayPrice || (price ? `from US$${price}` : "")} {priceType && <span className="text-sm font-normal text-gray-400">/ {priceType}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="p-2 sm:p-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add to Cart"
            >
              <CartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <Link href={displayHref}>
              <button className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-xs sm:text-sm">
                Details
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

