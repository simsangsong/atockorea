"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./Icons";
import { useTranslations } from "@/lib/i18n";
import { useCurrencyOptional } from "@/lib/currency";

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
  id?: number | string;
  slug?: string;
  title?: string; // Optional when tour is provided
  location?: string;
  type?: string;
  duration?: string;
  price?: number;
  originalPriceKRW?: number; // 할인 전 가격 (원가) — 있으면 카드에 표시
  priceType?: "person" | "group";
  image?: string;
  badge?: string;
  badgeVariant?: "default" | "brand"; // brand = blue (AtoC), default = orange
  variant?: "default" | "home"; // home = different layout for homepage
  rating?: number;
  reviewCount?: number;
  discount?: number; // Discount percentage (e.g., 20 for 20% off)
  // Support for Tour type
  tour?: Tour;
}

export default function TourCard({
  id,
  slug,
  title,
  location,
  type,
  duration,
  price,
  originalPriceKRW,
  priceType,
  image,
  badge,
  badgeVariant = "default",
  variant = "default",
  rating = 4.5,
  reviewCount = 0,
  discount,
  tour,
}: TourCardProps) {
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const [isAdding, setIsAdding] = useState(false);

  // Support both Tour type and individual props. Price: prop can be in thousands (price*1000 = KRW), or tour.price can be numeric KRW.
  const displayTitle = tour?.title || title || "";
  const displayLocation = tour?.city || location || "";
  const displayCategory = tour?.tag?.split(" · ")[0] || location || t('tourCard.tours');
  const displayType = tour?.tag?.split(" · ")[1] || type || "";
  // price prop: some callers pass KRW/1000 (e.g. TourList), others pass full KRW (e.g. RelatedTours). Use magnitude to infer.
  const priceKRW = price != null
    ? (price > 10000 ? price : price * 1000)
    : (typeof (tour as any)?.price === 'number' ? (tour as any).price : 0);
  const displayPrice = currencyCtx && priceKRW > 0
    ? currencyCtx.formatPrice(priceKRW)
    : (tour?.price || (price ? `₩ ${(price * 1000).toLocaleString()}` : ""));
  const displayOriginalPrice = originalPriceKRW != null && originalPriceKRW > priceKRW
    ? (currencyCtx ? currencyCtx.formatPrice(originalPriceKRW) : `₩ ${originalPriceKRW.toLocaleString()}`)
    : null;
  
  // Generate href based on available data
  // Priority: tour.href > /tour/[id] for API tours > city+slug route for static tours
  let displayHref = '/tours';
  
  // Get city from tour prop or location prop
  const city = tour?.city || displayLocation || '';
  const tourSlug = tour?.slug || slug;
  const tourId = id;
  
  // Check if id is a UUID (API tour) - UUIDs contain hyphens
  const isUUID = tourId && typeof tourId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourId);
  const isNumericId = tourId && !isNaN(Number(tourId)) && Number(tourId) > 0;
  
  if (tour?.href) {
    // If tour has explicit href, use it (highest priority)
    displayHref = tour.href;
  } else if (tourId && (isUUID || isNumericId)) {
    // API tours (UUID or numeric ID) should always use /tour/[id]
    // This ensures they go to the API-based detail page
    displayHref = `/tour/${tourId}`;
  } else if (city && tourSlug && !tourId) {
    // Static tours (no ID) can use city-based routes
    // These are from detailedTours static data
    const cityLower = city.toLowerCase();
    if (cityLower.includes('jeju') || cityLower === 'jeju') {
      displayHref = `/jeju/${tourSlug}`;
    } else if (cityLower.includes('busan') || cityLower === 'busan') {
      displayHref = `/busan/${tourSlug}`;
    } else if (cityLower.includes('seoul') || cityLower === 'seoul') {
      displayHref = `/seoul/${tourSlug}`;
    } else {
      // Unknown city, fallback to /tour/[slug]
      displayHref = `/tour/${tourSlug}`;
    }
  } else if (tourSlug) {
    // If only slug is available, use /tour/[slug]
    // The API can handle both UUID and slug
    displayHref = `/tour/${tourSlug}`;
  } else if (tourId) {
    // Fallback: use /tour/[id]
    displayHref = `/tour/${tourId}`;
  }
  
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

  // Home variant: image-heavy card, title on image, location + price below
  if (variant === "home") {
    return (
      <div className="group h-full flex flex-col rounded-2xl overflow-hidden border border-gray-200/50 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all duration-300 transform hover:-translate-y-1">
        <Link href={displayHref} className="block flex-1 flex flex-col">
          <div className="relative w-full aspect-[5/5.32] overflow-hidden">
            <Image
              src={displayImage}
              alt={displayTitle}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            {displayBadge && (
              <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-white text-[10px] font-semibold rounded-full shadow-lg ${
                badgeVariant === "brand" ? "bg-blue-600/90" : "bg-orange-500/90"
              }`}>
                {displayBadge}
              </span>
            )}
            {discount && (
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-red-500/90 text-white text-[10px] font-semibold rounded-full shadow-lg">
                -{discount}%
              </span>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3">
              <h3 className="text-base sm:text-lg font-semibold text-white line-clamp-3 drop-shadow-md group-hover:text-white/95 leading-snug">
                {displayTitle}
              </h3>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-3.5 sm:py-4 bg-white border-t border-gray-100 min-h-[3rem]">
            <span className="text-sm text-gray-500 truncate">{displayLocation || displayCategory}</span>
            <span className="text-right shrink-0 flex items-baseline gap-1.5">
              {displayOriginalPrice && (
                <span className="text-sm text-gray-400 line-through">{displayOriginalPrice}</span>
              )}
              <span className="text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">{displayPrice}</span>
            </span>
          </div>
        </Link>
      </div>
    );
  }

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
          {/* Badge overlay: brand = blue (AtoC), default = orange */}
          {displayBadge && (
            <div className="absolute top-2 left-2">
              <span className={`px-2 py-0.5 text-white text-[10px] font-semibold rounded shadow-sm ${
                badgeVariant === "brand" ? "bg-blue-600" : "bg-orange-500"
              }`}>
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
              {displayOriginalPrice && (
                <span className="text-xs text-gray-400 line-through mr-1.5">{displayOriginalPrice}</span>
              )}
              {displayPrice}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

