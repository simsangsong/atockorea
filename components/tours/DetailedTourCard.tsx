'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckIcon, MapIcon, CartIcon } from '@/components/Icons';

interface DetailedTourCardProps {
  tour: {
    id: number;
    title: string;
    location: string;
    rating: number;
    reviewCount: number;
    price: number;
    originalPrice: number;
    priceType: 'person' | 'group';
    duration: string;
    image: string;
    features: string[];
    itinerary: string[];
    pickupPoints: number;
    dropoffPoints: number;
  };
}

export default function DetailedTourCard({ tour }: DetailedTourCardProps) {
  const hasDiscount = tour.originalPrice > tour.price;
  const discountPercent = hasDiscount
    ? Math.round(((tour.originalPrice - tour.price) / tour.originalPrice) * 100)
    : 0;
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsAdding(false);
      alert(`${tour.title} added to cart!`);
      // In production, add to cart state/API
    }, 500);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow">
      {/* Mobile: 4-Grid Layout */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:hidden">
        {/* Top Left: Image (缩小) */}
        <div className="col-span-1 row-span-1 relative">
          <Link href={`/tour/${tour.id}`}>
            <div className="relative h-full w-full min-h-[100px] rounded-lg overflow-hidden">
              <Image
                src={tour.image}
                alt={tour.title}
                fill
                className="object-cover"
              />
              {hasDiscount && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shadow-md">
                  -{discountPercent}%
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Top Right: Features & Pickup Info */}
        <div className="col-span-1 row-span-1 flex flex-col justify-start gap-1">
          {/* Cart Button */}
          <div className="flex justify-end mb-1">
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add to Cart"
            >
              <CartIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Features */}
          <div className="space-y-0.5">
            {tour.features.slice(0, 2).map((feature, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[10px] text-gray-700">
                <CheckIcon className="w-3 h-3 text-green-600 flex-shrink-0" />
                <span className="truncate">{feature}</span>
              </div>
            ))}
          </div>
          {/* Pickup/Dropoff */}
          <div className="text-[10px] text-gray-600 mt-1">
            <div>{tour.pickupPoints} pickup{tour.pickupPoints !== 1 ? 's' : ''}</div>
            <div>{tour.dropoffPoints} dropoff{tour.dropoffPoints !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Bottom Left: Title & Price */}
        <div className="col-span-1 row-span-1 flex flex-col justify-start gap-1">
          {/* Title (在上) */}
          <Link href={`/tour/${tour.id}`}>
            <h2 className="text-xs font-bold text-gray-900 line-clamp-2 hover:text-indigo-600 transition-colors leading-tight">
              {tour.title}
            </h2>
          </Link>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-500 fill-current" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[10px] font-semibold text-gray-700">{tour.rating}</span>
            <span className="text-[10px] text-gray-500">({tour.reviewCount})</span>
          </div>
          {/* Price (在下) */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-indigo-600">${tour.price}</span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">${tour.originalPrice}</span>
            )}
            <span className="text-[10px] text-gray-500">/{tour.priceType}</span>
          </div>
        </div>

        {/* Bottom Right: Itinerary Timeline (单排) */}
        <div className="col-span-1 row-span-1 flex flex-col justify-start">
          <div className="flex flex-col gap-1">
            {tour.itinerary.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                </div>
                <span className="text-[12.96px] font-semibold text-gray-700 leading-snug flex-1">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: Horizontal Layout */}
      <div className="hidden sm:flex flex-row">
        {/* Left: Image */}
        <div className="w-64 lg:w-80 flex-shrink-0 relative">
          <Link href={`/tour/${tour.id}`}>
            <div className="relative h-full w-full min-h-[280px]">
              <Image
                src={tour.image}
                alt={tour.title}
                fill
                className="object-cover"
              />
              {hasDiscount && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-lg">
                  -{discountPercent}%
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col sm:flex-row p-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Title and Rating */}
            <div className="mb-4">
              <Link href={`/tour/${tour.id}`}>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors line-clamp-2">
                  {tour.title}
                </h2>
              </Link>
              <div className="flex items-center gap-2 text-base">
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-semibold text-gray-700">{tour.rating}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">({tour.reviewCount})</span>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-1 text-gray-600">
                  <MapIcon className="w-4 h-4" />
                  <span>{tour.location}</span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-indigo-600">${tour.price}</span>
                {hasDiscount && (
                  <span className="text-lg text-gray-400 line-through">${tour.originalPrice}</span>
                )}
                <span className="text-base text-gray-500">/ {tour.priceType}</span>
              </div>
            </div>

            {/* Features */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2.5">
                {tour.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-base text-gray-700">
                    <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="truncate">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Itinerary */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-2">
                {tour.itinerary.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full text-center truncate"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Pickup/Dropoff Points */}
            <div className="flex items-center gap-2 text-base text-gray-600">
              <span>{tour.pickupPoints} pickup{tour.pickupPoints !== 1 ? 's' : ''}</span>
              <span className="text-gray-400">•</span>
              <span>{tour.dropoffPoints} dropoff{tour.dropoffPoints !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-36 lg:w-40 flex-shrink-0 flex flex-col items-end gap-3">
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full px-4 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title="Add to Cart"
            >
              <CartIcon className="w-5 h-5" />
              <span className="text-base">Add to Cart</span>
            </button>
            <Link
              href={`/tour/${tour.id}`}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg text-center text-base"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

