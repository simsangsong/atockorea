"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "./Icons";
import { useTranslations, useI18n } from "@/lib/i18n";
import { formatTourDurationForCard } from "@/lib/tour-duration-display";
import { useCurrencyOptional } from "@/lib/currency";
import { isInWishlistLocal, toggleWishlistLocal } from "@/lib/wishlist";

// Format booking count for display (e.g. 1200 -> "1.2k", 50000 -> "50k")
function formatBookingCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

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
  bookingCount?: number; // Optional; hidden when not available
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
  bookingCount,
  discount,
  tour,
}: TourCardProps) {
  const t = useTranslations();
  const { locale } = useI18n();
  const currencyCtx = useCurrencyOptional();
  const [isAdding, setIsAdding] = useState(false);
  const tourKey = id != null ? String(id) : (slug ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tourKey) return;
    setSaved(isInWishlistLocal(tourKey));
  }, [tourKey]);

  // Support both Tour type and individual props. Price: prop can be in thousands (price*1000 = KRW), or tour.price can be numeric KRW.
  const displayTitle = tour?.title || title || "";
  const displayLocation = tour?.city || location || "";
  const displayCategory = tour?.tag?.split(" · ")[0] || location || t('tourCard.tours');
  const displayType = tour?.tag?.split(" · ")[1] || type || "";
  const displayDuration = formatTourDurationForCard(
    duration || (tour as Tour & { duration?: string })?.duration,
    locale
  );
  const displayRating = rating ?? 4.5;
  const displayReviewCount = reviewCount ?? 0;
  const showBookingCount = bookingCount != null && bookingCount > 0;
  // price prop: some callers pass KRW/1000 (e.g. TourList), others pass full KRW (e.g. RelatedTours). Use magnitude to infer.
  const tourPriceNum = tour && typeof (tour as Tour & { price?: number }).price === 'number' ? (tour as Tour & { price?: number }).price : 0;
  const priceKRW = price != null
    ? (price > 10000 ? price : price * 1000)
    : tourPriceNum;
  const displayPrice = currencyCtx && priceKRW > 0
    ? currencyCtx.formatPrice(priceKRW)
    : (tour?.price || (price ? `₩ ${(price * 1000).toLocaleString()}` : ""));
  const displayOriginalPrice = originalPriceKRW != null && originalPriceKRW > priceKRW
    ? (currencyCtx ? currencyCtx.formatPrice(originalPriceKRW) : `₩ ${originalPriceKRW.toLocaleString()}`)
    : null;
  // Discount %: use prop or derive from original vs current price; hide badge when 0
  const displayDiscountPercent =
    discount != null && discount > 0
      ? discount
      : originalPriceKRW != null && priceKRW > 0 && originalPriceKRW > priceKRW
        ? Math.round(((originalPriceKRW - priceKRW) / originalPriceKRW) * 100)
        : 0;
  const showDiscountBadge = displayDiscountPercent > 0;

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

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tourKey) return;
    setSaved(toggleWishlistLocal(tourKey));
  };

  // Home variant: one card — image with soft fade into content (harmonious)
  if (variant === "home") {
    return (
      <Link
        href={displayHref}
        className="group block h-full rounded-2xl overflow-hidden bg-white border border-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.1)] hover:border-gray-200 transition-all duration-300 transform hover:-translate-y-0.5"
      >
        {/* Image + gradient bridge into content (taller image) */}
        <div className="relative w-full aspect-[4/3.2] sm:aspect-[4/3.5] overflow-hidden shrink-0">
          <Image
            src={displayImage}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* 사진과 흰 영역 경계 그라데이션 (축소) */}
          <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/80 via-white/25 to-transparent pointer-events-none" />

          {/* 좌측 상단: Day 뱃지 + 할인 뱃지 세로 배치, 겹치지 않게 */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {displayBadge && (
              <span
                className={`px-2 py-1 text-white text-[10px] font-semibold rounded-md shadow-sm leading-none ${
                  badgeVariant === "brand" ? "bg-blue-600/95" : "bg-orange-500/95"
                }`}
              >
                {displayBadge}
              </span>
            )}
            {showDiscountBadge && (
              <span className="bg-red-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm leading-none">
                {t("tourCard.discountOff", { percent: displayDiscountPercent })}
              </span>
            )}
          </div>

          {/* 우측 상단: 위시리스트 하트 버튼만 */}
          {tourKey && (
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={handleWishlistClick}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md border border-gray-200/80 text-gray-600 hover:text-red-500 transition-colors touch-manipulation"
                aria-label={saved ? t("tour.removeFromWishlist") : t("tourCard.save")}
              >
                {saved ? (
                  <svg className="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content: compact — left accent on hover */}
        <div className="relative px-4 pt-2 pb-3 border-l-4 border-l-transparent group-hover:border-l-blue-500/50 transition-colors">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
            <span className="shrink-0" aria-hidden>📍</span>
            <span className="truncate">{displayLocation || displayCategory}</span>
          </div>
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug mb-1.5 group-hover:text-blue-700 transition-colors">
            {displayTitle}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mb-1">
            <span className="flex items-center gap-1">
              <span className="text-yellow-500" aria-hidden>⭐</span>
              <span className="font-semibold text-gray-900">{displayRating.toFixed(1)}</span>
              {displayReviewCount > 0 && (
                <span className="text-gray-500">({displayReviewCount.toLocaleString()})</span>
              )}
            </span>
            {displayDuration && (
              <span className="flex items-center gap-1">
                <span aria-hidden>🕒</span>
                <span>{displayDuration}</span>
              </span>
            )}
          </div>
          {showBookingCount && (
            <p className="text-[10px] text-gray-500 mb-1">
              {formatBookingCount(bookingCount!)}{" "}{t("tourCard.booked")}
            </p>
          )}
          <div className="flex items-center gap-2 flex-nowrap min-w-0">
            {displayOriginalPrice && (
              <span className="text-[11px] text-gray-400 line-through shrink-0">{displayOriginalPrice}</span>
            )}
            <span className="text-sm font-bold text-slate-700 truncate">
              {displayPrice}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden transition-all duration-300 group h-full flex flex-col border border-gray-200/40 md:border-gray-200/30 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.12),0_2px_12px_rgba(0,0,0,0.06)] hover:border-gray-200/50 transform hover:-translate-y-0.5 min-h-0 min-w-0">
      <Link href={displayHref} className="block flex-1 flex flex-col min-h-0">
        {/* 이미지 영역: 높이 비율 확대 */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[4/3.2] overflow-hidden shrink-0">
          <Image
            src={displayImage}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* 사진과 흰색 영역 경계 그라데이션 (축소) */}
          <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/80 via-white/25 to-transparent pointer-events-none" />
          {/* 좌측 상단: Day 뱃지 + 할인 뱃지 세로 배치, 겹치지 않게 */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
            {displayBadge && (
              <span
                className={`px-2 py-1 text-white text-[10px] font-semibold rounded-md shadow-sm leading-none ${
                  badgeVariant === "brand" ? "bg-blue-600" : "bg-orange-500"
                }`}
              >
                {displayBadge}
              </span>
            )}
            {showDiscountBadge && (
              <span className="bg-red-500 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm leading-none">
                {t("tourCard.discountOff", { percent: displayDiscountPercent })}
              </span>
            )}
          </div>
          {/* 우측 상단: 위시리스트만 */}
          {tourKey && (
            <div className="absolute top-2.5 right-2.5">
              <button
                type="button"
                onClick={handleWishlistClick}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm border border-gray-200/80 text-gray-600 hover:text-red-500 transition-colors touch-manipulation"
                aria-label={saved ? t("tour.removeFromWishlist") : t("tourCard.save")}
              >
                {saved ? (
                  <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        <div className="p-2.5 flex-1 flex flex-col min-h-0 bg-white">
          {/* Badge / Category */}
          <p className="text-[11px] text-gray-500 mb-0.5">
            {displayBadge || (displayCategory && displayType ? `${displayCategory} • ${displayType}` : displayCategory || t('tourCard.tours'))}
          </p>
          {/* Location */}
          {displayLocation && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-0.5">
              <span aria-hidden>📍</span>
              <span className="truncate">{displayLocation}</span>
            </div>
          )}
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 mb-1.5 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
            {displayTitle}
          </h3>
          {/* Rating + Duration */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mb-0.5">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-yellow-500 fill-current shrink-0" viewBox="0 0 20 20" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-semibold text-gray-900">{displayRating.toFixed(1)}</span>
              {displayReviewCount > 0 && (
                <span className="text-gray-500">({displayReviewCount.toLocaleString()})</span>
              )}
            </span>
            {displayDuration && (
              <span className="flex items-center gap-1">
                <span aria-hidden>🕒</span>
                <span>{displayDuration}</span>
              </span>
            )}
          </div>
          {/* Booking count (optional) */}
          {showBookingCount && (
            <p className="text-[10px] text-gray-500 mb-1">
              {formatBookingCount(bookingCount!)}{" "}{t("tourCard.booked")}
            </p>
          )}
          {/* Price — one line, smaller font */}
          <div className="mt-auto">
            <p className="text-xs font-semibold text-gray-900 flex items-center gap-2 flex-nowrap min-w-0">
              {displayOriginalPrice && (
                <span className="text-[11px] text-gray-400 line-through shrink-0">{displayOriginalPrice}</span>
              )}
              <span className="truncate">{displayPrice}</span>
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

