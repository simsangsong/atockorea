'use client';

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckIcon, MapIcon, CartIcon, HeartIcon, HeartSolidIcon } from '@/components/Icons';
import { isInWishlist, toggleWishlist } from '@/lib/wishlist';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';

interface DetailedTourCardProps {
  tour: {
    id: string | number;
    title: string;
    location: string;
    rating: number;
    reviewCount: number;
    price: number;
    originalPrice: number | null;
    priceType: 'person' | 'group';
    duration: string;
    image: string;
    features: string[];
    itinerary: string[];
    pickupPoints: any[];
    pickupPointsCount: number;
    dropoffPointsCount: number;
    lunchIncluded: boolean;
    ticketIncluded: boolean;
    includes: string[];
    excludes: string[];
    schedule: Array<{ time: string; title: string; description?: string }>;
    pickupInfo: string;
    notes: string;
  };
}

function DetailedTourCard({ tour }: DetailedTourCardProps) {
  const router = useRouter();
  const t = useTranslations();
  const currencyCtx = useCurrencyOptional();
  const hasDiscount = useMemo(() => 
    tour.originalPrice && tour.originalPrice > tour.price,
    [tour.originalPrice, tour.price]
  );
  const discountPercent = useMemo(() => 
    hasDiscount && tour.originalPrice
      ? Math.round(((tour.originalPrice - tour.price) / tour.originalPrice) * 100)
      : 0,
    [hasDiscount, tour.originalPrice, tour.price]
  );
  const [isAdding, setIsAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [checkingWishlist, setCheckingWishlist] = useState(true);

  const checkWishlistStatus = useCallback(async () => {
    try {
      setCheckingWishlist(true);
      const status = await isInWishlist(tour.id.toString());
      setIsFavorite(status);
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    } finally {
      setCheckingWishlist(false);
    }
  }, [tour.id]);

  useEffect(() => {
    checkWishlistStatus();
  }, [checkWishlistStatus]);

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    
    try {
      // TODO: Implement actual cart API call
      await new Promise(resolve => setTimeout(resolve, 500));
      alert(`${tour.title} added to cart!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  }, [tour.title]);

  const handleWishlistToggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setWishlistLoading(true);
      const result = await toggleWishlist(tour.id.toString(), isFavorite);
      
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
      setWishlistLoading(false);
    }
  }, [tour.id, isFavorite, router]);

  const formatPrice = (price: number) => {
    if (currencyCtx) return currencyCtx.formatPrice(price);
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(price);
  };

  // Filter schedule to exclude pickup points (only main stops)
  const mainStops = useMemo(() => {
    if (!tour.schedule || tour.schedule.length === 0) return [];
    return tour.schedule.filter((item) => {
      const title = item.title?.toLowerCase() || '';
      // Exclude pickup, dropoff, and lunch items
      return !title.includes('pickup') && 
             !title.includes('drop-off') && 
             !title.includes('dropoff') &&
             !title.includes('lunch');
    });
  }, [tour.schedule]);

  // Color dots for each stop
  const dotColors = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  const getDotColor = (index: number) => dotColors[index % dotColors.length];

  // 모바일에서 일정 표시 개수 제한 (카드 컴팩트하게)
  const MOBILE_STOPS_VISIBLE = 3;
  const mobileStops = useMemo(() => mainStops.slice(0, MOBILE_STOPS_VISIBLE), [mainStops]);
  const remainingStopsCount = mainStops.length - MOBILE_STOPS_VISIBLE;

  return (
    <>
      {/* 모바일: 컴팩트하고 고급스러운 디자인 */}
      <article className="bg-white rounded-xl border border-gray-200/60 shadow-md overflow-hidden hover:shadow-lg transition-all duration-200 sm:hidden">
        <div className="flex flex-row">
          {/* LEFT: 38% - 위 절반 사진 + 아래 절반 제목/가격 */}
          <div className="flex flex-col w-[38%] flex-shrink-0">
            {/* 위 절반: 이미지 */}
            <div className="relative w-full h-[97px]">
              <Link href={`/tour/${tour.id}`}>
                <Image
                  src={tour.image || '/placeholder-tour.jpg'}
                  alt={tour.title}
                  fill
                  className="object-cover"
                  sizes="38vw"
                  loading="lazy"
                />
              </Link>
              {hasDiscount && discountPercent > 0 ? (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shadow z-10">
                  {discountPercent}% OFF
                </div>
              ) : null}
            </div>
            
            {/* 아래 절반: 제목 + 가격 (가격은 아래쪽 고정) */}
            <div className="flex flex-col p-2 bg-gradient-to-b from-gray-50 to-white min-h-[97px]">
              <h3 className="text-xs font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors leading-tight line-clamp-2">
                <Link href={`/tour/${tour.id}`}>{tour.title}</Link>
              </h3>
              <div className="flex flex-col gap-0.5 mt-auto">
                {hasDiscount ? (
                  <>
                    <span className="text-[10px] text-gray-500 line-through">
                      {formatPrice(tour.originalPrice!)}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-purple-600">
                        {formatPrice(tour.price)}
                      </span>
                      <span className="text-[10px] text-gray-500">/{tour.priceType}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-purple-600">
                      {formatPrice(tour.price)}
                    </span>
                    <span className="text-[10px] text-gray-500">/{tour.priceType}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: 62% - 포함사항 + 일정(최대 3개) + 버튼 */}
          <div className="flex flex-col flex-1 p-2 min-w-0 bg-white">
            {/* 포함사항 - 한 줄 초컴팩트 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="h-1 w-1 rounded-full bg-purple-500 flex-shrink-0" />
              <span className="text-[10px] text-gray-600 truncate">
                {tour.pickupPointsCount > 0 ? `${tour.pickupPointsCount} pickup` : t('tour.pickup')}
              </span>
              {tour.ticketIncluded && <span className="text-[10px] opacity-80">🎫</span>}
              {tour.lunchIncluded && <span className="text-[10px] opacity-80">🍽</span>}
            </div>

            {/* 일정 - 모바일에서는 최대 3개만 표시 + "N more" */}
            {(mobileStops.length > 0 || (mainStops.length === 0 && tour.features?.length > 0)) && (
              <div className="mb-2 flex-1 min-h-0">
                <div className="space-y-0.5">
                  {mobileStops.length > 0
                    ? mobileStops.map((item, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <span className={`h-1 w-1 rounded-full ${getDotColor(index)} flex-shrink-0`} />
                          <span className="text-[10px] text-gray-700 leading-tight line-clamp-1 truncate">
                            {item.title}
                          </span>
                        </div>
                      ))
                    : tour.features?.slice(0, MOBILE_STOPS_VISIBLE).map((feature, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <span className={`h-1 w-1 rounded-full ${getDotColor(index)} flex-shrink-0`} />
                          <span className="text-[10px] text-gray-700 leading-tight line-clamp-1 truncate">
                            {feature}
                          </span>
                        </div>
                      ))}
                  {remainingStopsCount > 0 && (
                    <p className="text-[10px] text-gray-500 pl-2.5 pt-0.5">+{remainingStopsCount} more</p>
                  )}
                  {mainStops.length === 0 && tour.features?.length > MOBILE_STOPS_VISIBLE && (
                    <p className="text-[10px] text-gray-500 pl-2.5 pt-0.5">+{tour.features.length - MOBILE_STOPS_VISIBLE} more</p>
                  )}
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-1.5 pt-1.5 mt-auto border-t border-gray-100">
              <button
                onClick={handleWishlistToggle}
                disabled={checkingWishlist || wishlistLoading}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
                title={isFavorite ? t('tour.removeFromWishlist') : t('tour.addToWishlist')}
              >
                {checkingWishlist || wishlistLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : isFavorite ? (
                  <HeartSolidIcon className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] rounded-lg transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <CartIcon className="w-3.5 h-3.5" />
                <span>{isAdding ? t('common.adding') : t('tour.cart')}</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* 데스크탑: 원래 크기 */}
      <article className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
        <div className="flex flex-row gap-4 p-4">
          {/* Image */}
          <div className="w-48 h-48 flex-shrink-0 relative rounded-lg overflow-hidden bg-gray-100">
            <Link href={`/tour/${tour.id}`}>
              <Image
                src={tour.image || '/placeholder-tour.jpg'}
                alt={tour.title}
                fill
                className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                sizes="192px"
                loading="lazy"
              />
            </Link>
            {hasDiscount && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-md">
                {discountPercent}% OFF
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <Link href={`/tour/${tour.id}`} className="flex-1 pr-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 hover:text-indigo-600 transition-colors line-clamp-2">
                    {tour.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <MapIcon className="w-4 h-4" />
                      <span>{tour.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium">{tour.rating.toFixed(1)}</span>
                      <span className="text-gray-400">({tour.reviewCount})</span>
                    </div>
                    <span>{tour.duration}</span>
                  </div>
                </Link>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-3">
                {tour.features.slice(0, 4).map((feature, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded">
                    {feature}
                  </span>
                ))}
              </div>

              {/* Info */}
              <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                <span>{tour.pickupPointsCount} pickup points</span>
                <span>{tour.dropoffPointsCount} dropoff points</span>
              </div>
            </div>

            {/* Bottom Section: Price and Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              {/* Price */}
              <div className="flex items-baseline gap-2">
                {hasDiscount && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatPrice(tour.originalPrice!)}
                  </span>
                )}
                <span className="text-2xl font-bold text-indigo-600">{formatPrice(tour.price)}</span>
                <span className="text-sm text-gray-500">/ {tour.priceType}</span>
              </div>

              {/* Action Buttons */}
              <div className="w-36 lg:w-40 flex-shrink-0 flex flex-col items-end gap-3">
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleWishlistToggle}
                    disabled={checkingWishlist || wishlistLoading}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                    title={isFavorite ? t('tour.removeFromWishlist') : t('tour.addToWishlist')}
                  >
                    {checkingWishlist || wishlistLoading ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : isFavorite ? (
                      <HeartSolidIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <HeartIcon className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    disabled={isAdding}
                    className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Add to Cart"
                  >
                    <CartIcon className="w-5 h-5" />
                    <span className="text-sm">{isAdding ? 'Adding...' : 'Cart'}</span>
                  </button>
                </div>
                <Link
                  href={`/tour/${tour.id}`}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg text-center text-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

export default memo(DetailedTourCard);
