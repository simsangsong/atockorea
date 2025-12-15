"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./Icons";
import { useTranslations } from "@/lib/i18n";

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
  discount?: number; // Discount percentage (e.g., 20 for 20% off)
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
  discount,
  tour,
}: TourCardProps) {
  const t = useTranslations();
  const [isAdding, setIsAdding] = useState(false);

  // Support both Tour type and individual props
  const displayTitle = tour?.title || title || "";
  const displayLocation = tour?.city || location || "";
  const displayCategory = tour?.tag?.split(" · ")[0] || location || t('tourCard.tours');
  const displayType = tour?.tag?.split(" · ")[1] || type || "";
  const displayPrice = tour?.price || (price ? `₩ ${(price * 1000).toLocaleString()}` : "");
  const displayHref = tour?.href || `/tour/${id || 1}`;
  const displayImage = image || "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";
  const displayBadge = badge || tour?.tag?.split(" · ")[1] || "";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsAdding(false);
      alert(`${displayTitle} ${t('tourCard.addedToCart')}`);
      // In production, add to cart state/API
    }, 500);
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden transition-all duration-300 group h-full flex flex-col border border-gray-200/40 md:border-gray-200/30 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.12),0_2px_12px_rgba(0,0,0,0.06)] hover:border-gray-200/50 transform hover:-translate-y-0.5">
      <Link href={displayHref} className="block flex-1 flex flex-col">
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <Image
            src={displayImage}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Badge overlay (like Klook's orange banner) */}
          {displayBadge && (
            <div className="absolute top-2 left-2">
              <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-semibold rounded shadow-sm">
                {displayBadge}
              </span>
            </div>
          )}
          {/* Discount tag */}
          {discount && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-semibold rounded shadow-sm">
                {t('tourCard.sale')} {discount}% {t('tourCard.off')}
              </span>
            </div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col bg-gradient-to-b from-white to-gray-50/30">
          {/* Category label */}
          <p className="text-[11px] text-gray-500 mb-1">
            {displayCategory && displayType ? `${displayCategory} • ${displayType}` : displayCategory || t('tourCard.tours')}
          </p>
          
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
            {displayTitle}
          </h3>
          
          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <svg className="w-3.5 h-3.5 text-yellow-500 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-semibold text-gray-900">{rating}</span>
            {reviewCount > 0 && (
              <span className="text-xs text-gray-500">({reviewCount.toLocaleString()})</span>
            )}
          </div>
          
          {/* Price */}
          <div className="mt-auto">
            <p className="text-sm font-semibold text-gray-900">
              {displayPrice}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

